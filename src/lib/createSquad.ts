import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import Squads, { getMsPDA } from '@sqds/sdk';
import { WalletContextState } from '@solana/wallet-adapter-react';

export async function createMultisig(
  wallet: WalletContextState,
  connection: Connection,
  user: PublicKey,
  members: string[],
  threshold: number,
  createKey: PublicKey,
  programId: PublicKey
) {
  try {
    const squads = Squads.mainnet(wallet as any, { multisigProgramId: programId });

    const [multisigPda] = getMsPDA(createKey, programId);

    const memberPublicKeys = members.map((member) => new PublicKey(member));

    const createSquadIx = await squads.buildCreateMultisig(threshold, createKey, memberPublicKeys);

    const tx = new Transaction().add(createSquadIx);

    tx.feePayer = user;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    return { transaction: tx, multisig: multisigPda };
  } catch (err) {
    throw err;
  }
}
