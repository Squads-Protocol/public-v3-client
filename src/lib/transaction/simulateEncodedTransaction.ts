import { toast } from "sonner";
import { decodeAndDeserialize } from "./decodeAndDeserialize";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { getAccountsForSimulation } from "./getAccountsForSimulation";

export const simulateEncodedTransaction = async (
  tx: string,
  connection: Connection,
  wallet: WalletContextState
) => {
  if (!wallet.publicKey) {
    throw new Error('Please connect your wallet.');
  }
  try {
    const { message, version } = decodeAndDeserialize(tx);

    const transaction = new VersionedTransaction(message.compileToV0Message());

    const keys = await getAccountsForSimulation(
      connection,
      transaction,
      version === 0
    );

    toast.loading("Simulating...", {
      id: "simulation",
    });
    const { value } = await connection.simulateTransaction(transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: "confirmed",
      accounts: {
        encoding: "base64",
        addresses: keys,
      },
    });

    if (value.err) {
      throw new Error(`Simulation failed: ${JSON.stringify(value.err)}`);
    }
  } catch (error: any) {
    throw error instanceof Error ? error : new Error(String(error));
  }
};
