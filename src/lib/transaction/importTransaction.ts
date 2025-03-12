import {Connection, PublicKey, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {decodeAndDeserialize} from './decodeAndDeserialize';
import {WalletContextState} from '@solana/wallet-adapter-react';
import {toast} from 'sonner';
import {loadLookupTables} from './getAccountsForSimulation';
import {createSquadTransactionInstructions} from '@/lib/createSquadTransactionInstructions';
import {waitForConfirmation} from "~/lib/transactionConfirmation";

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
    const {message, version} = decodeAndDeserialize(tx);

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
    
    const hasSent = await waitForConfirmation(connection, [signature]);
    if (!hasSent.every((s) => !!s)) {
      throw `Unable to confirm transaction`;
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};
