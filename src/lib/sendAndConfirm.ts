import {Connection, SignatureStatus, Transaction, VersionedTransaction} from '@solana/web3.js';
import {WalletContextState} from '@solana/wallet-adapter-react';
import {toast} from 'sonner';
import bs58 from 'bs58';

function truncateSig(sig: string): string {
  return `${sig.slice(0, 8)}…`;
}

function parseSigningError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|rejected the request|approval denied/i.test(msg)) {
    return 'Transaction rejected by wallet.';
  }
  if (/not connected|no wallet/i.test(msg)) {
    return 'Wallet not connected.';
  }
  return `Signing failed: ${msg}`;
}

function parseSendError(e: unknown): string {
  if (e instanceof Error) {
    const logs: string[] | undefined = (e as any).logs;
    if (logs?.length) {
      const relevant = logs.find((l) => /Error|failed|insufficient/i.test(l));
      if (relevant) return `Send failed: ${relevant}`;
    }
    if (/blockhash not found/i.test(e.message)) return 'Transaction expired — please try again.';
    if (/insufficient.*fee|not enough sol/i.test(e.message))
      return 'Insufficient funds for transaction fee.';
    return `Send failed: ${e.message}`;
  }
  return `Send failed: ${String(e)}`;
}

function parseConfirmError(e: unknown, sig: string): string {
  if (e instanceof Error) {
    if (/not confirmed|timed out/i.test(e.message)) {
      return `Not confirmed after 30s — check explorer for ${truncateSig(sig)}.`;
    }
    return e.message;
  }
  return String(e);
}

async function confirmWithBackoff(
  connection: Connection,
  signature: string,
  maxMs = 30_000
): Promise<SignatureStatus> {
  const deadline = Date.now() + maxMs;
  let delay = 2_000;

  while (Date.now() < deadline) {
    const {
      value: [status],
    } = await connection.getSignatureStatuses([signature], {searchTransactionHistory: true});

    if (status) {
      if (status.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
        return status;
      }
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(delay, remaining)));
    delay = Math.min(delay * 2, 10_000);
  }

  throw new Error('Transaction not confirmed after 30s');
}

function extractSignature(tx: Transaction | VersionedTransaction): string {
  if (tx instanceof VersionedTransaction) {
    return bs58.encode(tx.signatures[0]);
  }
  const sig = (tx as Transaction).signatures[0]?.signature;
  if (!sig) throw new Error('No signature on signed transaction.');
  return bs58.encode(sig);
}

/**
 * Signs a transaction with the connected wallet, sends it to the RPC, and
 * waits for confirmation — updating a single toast through each step.
 *
 * Pass successMessage=null to suppress the success toast when the caller
 * wants to show its own custom success UI.
 */
export async function sendAndConfirm(
  connection: Connection,
  transaction: Transaction | VersionedTransaction,
  wallet: WalletContextState,
  successMessage: string | null = 'Transaction confirmed.'
): Promise<string> {
  if (!wallet.signTransaction) throw new Error('Wallet does not support signing.');

  // Ensure legacy transactions have a blockhash and fee payer before signing
  if (transaction instanceof Transaction) {
    if (!transaction.recentBlockhash) {
      const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
    }
    if (!transaction.feePayer && wallet.publicKey) {
      transaction.feePayer = wallet.publicKey;
    }
  }

  // ── 1. Sign ──────────────────────────────────────────────────────────────
  const id = toast.loading('Signing with wallet…', {duration: Infinity});

  let signedTx: Transaction | VersionedTransaction;
  try {
    signedTx = await wallet.signTransaction(transaction as any);
  } catch (e) {
    toast.error(parseSigningError(e), {id});
    throw e;
  }

  const sig = extractSignature(signedTx);
  const short = truncateSig(sig);

  // ── 2. Send ───────────────────────────────────────────────────────────────
  toast.loading(`Sending transaction ${short}…`, {id, duration: Infinity});

  try {
    await connection.sendRawTransaction(signedTx.serialize(), {skipPreflight: true});
  } catch (e) {
    toast.error(parseSendError(e), {id});
    throw e;
  }

  // ── 3. Confirm ────────────────────────────────────────────────────────────
  toast.loading(`Confirming ${short}…`, {id, duration: Infinity});

  try {
    await confirmWithBackoff(connection, sig);
  } catch (e) {
    toast.error(parseConfirmError(e, sig), {id});
    throw e;
  }

  if (successMessage !== null) {
    toast.success(successMessage, {id});
  } else {
    toast.dismiss(id);
  }

  return sig;
}

/**
 * Signs multiple versioned transactions in a single wallet prompt, then sends
 * and confirms each one sequentially.  Used by ExecuteButton when a large
 * transaction is split across multiple instructions.
 */
export async function signAllAndConfirm(
  connection: Connection,
  transactions: VersionedTransaction[],
  wallet: WalletContextState
): Promise<string[]> {
  if (!wallet.signAllTransactions) throw new Error('Wallet does not support batch signing.');

  const count = transactions.length;
  const txLabel = count > 1 ? `${count} transactions` : 'transaction';
  const id = toast.loading(`Signing ${txLabel} with wallet…`, {duration: Infinity});

  let signedTxs: VersionedTransaction[];
  try {
    signedTxs = await wallet.signAllTransactions(transactions);
  } catch (e) {
    toast.error(parseSigningError(e), {id});
    throw e;
  }

  const signatures: string[] = [];

  for (let i = 0; i < signedTxs.length; i++) {
    const signedTx = signedTxs[i];
    const sig = bs58.encode(signedTx.signatures[0]);
    const short = truncateSig(sig);
    const progress = count > 1 ? ` (${i + 1}/${count})` : '';

    toast.loading(`Sending transaction ${short}${progress}…`, {id, duration: Infinity});
    try {
      await connection.sendRawTransaction(signedTx.serialize(), {skipPreflight: true});
    } catch (e) {
      toast.error(parseSendError(e), {id});
      throw e;
    }

    toast.loading(`Confirming ${short}${progress}…`, {id, duration: Infinity});
    try {
      await confirmWithBackoff(connection, sig);
    } catch (e) {
      toast.error(parseConfirmError(e, sig), {id});
      throw e;
    }

    signatures.push(sig);
  }

  toast.success(count > 1 ? `All ${count} transactions confirmed.` : 'Transaction confirmed.', {
    id,
  });
  return signatures;
}
