'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { useMultisigData } from '@/hooks/useMultisigData';
import Squads, { getTxPDA, TransactionAccount } from '@sqds/sdk';
import { useWallet } from '@solana/wallet-adapter-react';
import BN from 'bn.js';

export interface TransactionObject {
  account: TransactionAccount;
  address: PublicKey;
}

// load multisig
export const useMultisig = () => {
  const { rpcUrl, programId, multisigAddress } = useMultisigData();
  const wallet = useWallet();

  return useSuspenseQuery({
    queryKey: ['multisig', multisigAddress],
    queryFn: async () => {
      if (!multisigAddress) return null;
      try {
        const multisigPubkey = new PublicKey(multisigAddress);

        const squads = Squads.endpoint(rpcUrl, wallet as any, { multisigProgramId: programId });

        return squads.getMultisig(multisigPubkey);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
  });
};

export const useBalance = () => {
  const { connection, multisigVault } = useMultisigData();

  return useSuspenseQuery({
    queryKey: ['balance', multisigVault?.toBase58()],
    queryFn: async () => {
      if (!multisigVault) return null;
      try {
        return connection.getBalance(multisigVault);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
  });
};

export const useGetTokens = () => {
  const { connection, multisigVault } = useMultisigData();

  return useSuspenseQuery({
    queryKey: ['tokenBalances', multisigVault?.toBase58()],
    queryFn: async () => {
      if (!multisigVault) return null;
      try {
        return connection.getParsedTokenAccountsByOwner(multisigVault, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        });
      } catch (error) {
        console.error(error);
        return null;
      }
    },
  });
};

// Transactions
async function fetchTransactionData(
  squads: Squads,
  multisigPda: PublicKey,
  index: bigint,
  programId: PublicKey
) {
  const [transactionPda] = getTxPDA(multisigPda, new BN(index.toString()), programId);

  let transaction;
  try {
    transaction = await squads.getTransaction(transactionPda);
  } catch (error) {
    return null;
  }

  return { account: transaction, address: transactionPda };
}

export const useTransactions = (startIndex: number, endIndex: number) => {
  const { programId, multisigAddress, rpcUrl } = useMultisigData();
  const wallet = useWallet();

  return useSuspenseQuery({
    queryKey: ['transactions', startIndex, endIndex, multisigAddress, programId.toBase58()],
    queryFn: async () => {
      if (!multisigAddress) return null;
      try {
        const multisigPda = new PublicKey(multisigAddress);
        const results: TransactionObject[] = [];

        const squads = Squads.endpoint(rpcUrl, wallet as any, { multisigProgramId: programId });

        for (let i = 0; i <= startIndex - endIndex; i++) {
          const index = BigInt(startIndex - i);
          const transaction = await fetchTransactionData(squads, multisigPda, index, programId);
          if (transaction) results.push(transaction);
        }

        return results;
      } catch (error) {
        console.error(error);
        return null;
      }
    },
  });
};
