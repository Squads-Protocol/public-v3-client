import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { Button } from './ui/button';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { toast } from 'sonner';
import { Dialog, DialogDescription, DialogHeader } from './ui/dialog';
import { DialogTrigger } from './ui/dialog';
import { DialogContent, DialogTitle } from './ui/dialog';
import { useState } from 'react';
import { Input } from './ui/input';
import { range } from '@/lib/utils';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useQueryClient } from '@tanstack/react-query';
import Squads, { getIxPDA, getTxPDA } from '@sqds/sdk';
import BN from 'bn.js';

type ExecuteButtonProps = {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
};

const ExecuteButton = ({
  multisigPda,
  transactionIndex,
  proposalStatus,
  programId,
}: ExecuteButtonProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const [priorityFeeLamports, setPriorityFeeLamports] = useState<number>(5000);
  const [computeUnitBudget, setComputeUnitBudget] = useState<number>(200_000);

  const isTransactionReady = proposalStatus === 'ExecuteReady';

  const { connection, rpcUrl } = useMultisigData();
  const queryClient = useQueryClient();

  const executeTransaction = async () => {
    try {
      if (!wallet.publicKey) {
        walletModal.setVisible(true);
        return;
      }
      if (!wallet.signAllTransactions) return;

      if (!isTransactionReady) {
        toast.error('Proposal has not reached threshold.');
        return;
      }

      const member = wallet.publicKey;

      const squads = Squads.endpoint(rpcUrl, wallet as any, {
        multisigProgramId: new PublicKey(programId),
      });

      const [txPDA] = getTxPDA(
        new PublicKey(multisigPda),
        new BN(transactionIndex),
        new PublicKey(programId)
      );

      const executeIx = await squads.buildExecuteTransaction(txPDA);

      let transactions: VersionedTransaction[] = [];

      const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFeeLamports,
      });
      const computeUnitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnitBudget,
      });

      const blockhash = (await connection.getLatestBlockhash()).blockhash;

      const dummyTx = new Transaction().add(executeIx);
      dummyTx.recentBlockhash = blockhash;
      dummyTx.feePayer = member;

      if (dummyTx.serializeMessage().length + 64 > 1050) {
        const txState = await squads.getTransaction(txPDA);
        transactions.push(
          ...(await Promise.all(
            range(txState.executedIndex + 1, txState.instructionIndex).map(async (ixIndex) => {
              console.log(ixIndex);
              const [ixPDA] = getIxPDA(txPDA, new BN(ixIndex), new PublicKey(programId));
              const ixExecuteIx = await squads.buildExecuteInstruction(txPDA, ixPDA);

              const message = new TransactionMessage({
                payerKey: member,
                recentBlockhash: blockhash,
                instructions: [priorityFeeInstruction, computeUnitInstruction, ixExecuteIx],
              }).compileToV0Message();

              return new VersionedTransaction(message);
            })
          ))
        );
      } else {
        transactions.push(
          new VersionedTransaction(
            new TransactionMessage({
              instructions: [priorityFeeInstruction, computeUnitInstruction, executeIx],
              payerKey: member,
              recentBlockhash: blockhash,
            }).compileToV0Message()
          )
        );
      }

      const signedTransactions = await wallet.signAllTransactions(transactions);

      for (const signedTx of signedTransactions) {
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: true,
        });
        console.log('Transaction signature', signature);
        toast.loading('Confirming...', {
          id: 'transaction',
        });
        await connection.getSignatureStatuses([signature]);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (e) {
      console.error(e);
    }
  };
  return (
    <Dialog>
      <DialogTrigger
        disabled={!isTransactionReady}
        className={`mr-2 h-10 px-4 py-2 ${!isTransactionReady ? `bg-primary/50` : `bg-primary hover:bg-primary/90 `} text-primary-foreground  rounded-md`}
      >
        Execute
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Execute Transaction</DialogTitle>
          <DialogDescription>
            Select custom priority fees and compute unit limits and execute transaction.
          </DialogDescription>
        </DialogHeader>
        <h3>Priority Fee in lamports</h3>
        <Input
          placeholder="Priority Fee"
          onChange={(e) => setPriorityFeeLamports(Number(e.target.value))}
          value={priorityFeeLamports}
        />

        <h3>Compute Unit Budget</h3>
        <Input
          placeholder="Priority Fee"
          onChange={(e) => setComputeUnitBudget(Number(e.target.value))}
          value={computeUnitBudget}
        />
        <Button
          disabled={!isTransactionReady}
          onClick={() =>
            toast.promise(executeTransaction, {
              id: 'transaction',
              loading: 'Loading...',
              success: 'Transaction executed.',
              error: 'Failed to execute. Check console for info.',
            })
          }
          className="mr-2"
        >
          Execute
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ExecuteButton;
