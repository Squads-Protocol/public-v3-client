import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { decodeAndDeserialize } from './decodeAndDeserialize';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { loadLookupTables } from './getAccountsForSimulation';
import { createSquadTransactionInstructions } from '@/lib/createSquadTransactionInstructions';

export const importTransaction = async (
  tx: string,
  connection: Connection,
  multisigPda: string,
  programId: string,
  wallet: WalletContextState
) => {
  if (!wallet.publicKey) {
    throw 'Please connect your wallet.';
  }
  try {
    const { message, version } = decodeAndDeserialize(tx);

    const addressLookupTableAccounts =
      version === 0 ? await loadLookupTables(connection, message.compileToV0Message()) : [];

    console.log(addressLookupTableAccounts);
    console.log(message);

    const originalMessage = TransactionMessage.decompile(message.compileToV0Message(), {
      addressLookupTableAccounts,
    });

    const instructions = await createSquadTransactionInstructions({
      wallet,
      multisigPda: new PublicKey(multisigPda),
      ixs: originalMessage.instructions,
      rpcUrl: connection.rpcEndpoint,
      programId: new PublicKey(programId),
    });

    const blockhash = (await connection.getLatestBlockhash()).blockhash;

    const wrappedMessage = new TransactionMessage({
      instructions,
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(wrappedMessage);

    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: true,
    });
    console.log('Transaction signature', signature);
    toast.loading('Confirming...', {
      id: 'transaction',
    });

    let sent = false;
    const maxAttempts = 10;
    const delayMs = 1000;
    for (let attempt = 0; attempt <= maxAttempts && !sent; attempt++) {
      const status = await connection.getSignatureStatus(signature);
      if (status?.value?.confirmationStatus === 'confirmed') {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        sent = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  } catch (error) {
    console.error(error);
  }
};
