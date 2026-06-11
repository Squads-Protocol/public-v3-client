import { PublicKey } from '@solana/web3.js';
import Squads, { getIxPDA, InstructionAccount, TransactionAccount } from '@sqds/sdk';
import BN from 'bn.js';

export interface DecodedAccount {
  address: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface DecodedInstruction {
  index: number;
  programId: string;
  accounts: DecodedAccount[];
  data: Uint8Array;
  executed: boolean;
}

export interface DecodedV3Transaction {
  transactionPda: string;
  authorityIndex: number;
  executedIndex: number;
  instructionIndex: number;
  instructions: DecodedInstruction[];
}

function fromMsInstruction(ix: InstructionAccount): DecodedInstruction {
  const dataBuf: Buffer = (ix as { data: Buffer }).data;
  return {
    index: Number(ix.instructionIndex),
    programId: (ix.programId as PublicKey).toBase58(),
    accounts: (ix.keys as Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>).map(
      (k) => ({
        address: k.pubkey.toBase58(),
        isSigner: k.isSigner,
        isWritable: k.isWritable,
      })
    ),
    data: new Uint8Array(dataBuf),
    executed: Boolean((ix as { executed: boolean }).executed),
  };
}

export async function decodeV3Transaction(
  squads: Squads,
  transactionPda: PublicKey,
  programId: PublicKey,
  preloadedTxAccount?: TransactionAccount
): Promise<DecodedV3Transaction> {
  const txAccount = preloadedTxAccount ?? (await squads.getTransaction(transactionPda));

  const lastIxIndex = Number(txAccount.instructionIndex);
  const executedIndex = Number(txAccount.executedIndex);
  const authorityIndex = Number(txAccount.authorityIndex);

  const ixPdas: PublicKey[] = [];
  for (let i = 1; i <= lastIxIndex; i++) {
    const [pda] = getIxPDA(transactionPda, new BN(i), programId);
    ixPdas.push(pda);
  }

  const ixAccounts =
    ixPdas.length === 0 ? [] : await squads.getInstructions(ixPdas);

  const instructions: DecodedInstruction[] = ixAccounts
    .map((ix) => (ix ? fromMsInstruction(ix) : null))
    .filter((ix): ix is DecodedInstruction => ix !== null);

  return {
    transactionPda: transactionPda.toBase58(),
    authorityIndex,
    executedIndex,
    instructionIndex: lastIxIndex,
    instructions,
  };
}
