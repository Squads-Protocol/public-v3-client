import Squads, { getTxPDA } from '@sqds/sdk';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

export const createSquadTransactionInstructions = async ({
  wallet,
  multisigPda,
  ixs,
  rpcUrl,
  programId,
}: {
  wallet: WalletContextState;
  multisigPda: PublicKey;
  ixs: TransactionInstruction[];
  rpcUrl: string;
  programId: PublicKey;
}) => {
  const instructions: TransactionInstruction[] = [];

  const squads = Squads.endpoint(rpcUrl, wallet as any, { multisigProgramId: programId });

  const nextTxIndex = await squads.getNextTransactionIndex(multisigPda);
  const [txPDA] = getTxPDA(multisigPda, new BN(nextTxIndex), programId);

  instructions.push(await squads.buildCreateTransaction(multisigPda, 1, nextTxIndex));

  for (const ix of ixs) {
    const i = ixs.indexOf(ix);
    instructions.push(await squads.buildAddInstruction(multisigPda, txPDA, ix, i + 1));
  }
  instructions.push(await squads.buildActivateTransaction(multisigPda, txPDA));
  instructions.push(await squads.buildApproveTransaction(multisigPda, txPDA));

  return instructions;
};
