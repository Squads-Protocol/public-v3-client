'use client';
import {PublicKey, Transaction} from '@solana/web3.js';
import {Button} from './ui/button';
import {useWallet} from '@solana/wallet-adapter-react';
import {useWalletModal} from '@solana/wallet-adapter-react-ui';
import {toast} from 'sonner';
import {useMultisigData} from '@/hooks/useMultisigData';
import {useQueryClient} from '@tanstack/react-query';
import BN from 'bn.js';
import Squads, {getTxPDA} from '@sqds/sdk';
import {useAccess} from "../lib/hooks/useAccess";
import {waitForConfirmation} from "../lib/transactionConfirmation";

type CancelButtonProps = {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
};

const CancelButton = ({
                        multisigPda,
                        transactionIndex,
                        proposalStatus,
                        programId,
                      }: CancelButtonProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const access = useAccess();

  const isTransactionReady = proposalStatus === 'ExecuteReady';

  const {connection, rpcUrl} = useMultisigData();
  const queryClient = useQueryClient();

  const cancelTransaction = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      return;
    }

    if (!isTransactionReady) {
      toast.error('Proposal has not reached threshold.');
      return;
    }

    const squads = Squads.endpoint(rpcUrl, wallet as any, {
      multisigProgramId: new PublicKey(programId),
    });

    const [txPDA] = getTxPDA(
      new PublicKey(multisigPda),
      new BN(transactionIndex),
      new PublicKey(programId)
    );

    const transaction = new Transaction();

    const cancelIx = await squads.buildCancelTransaction(new PublicKey(multisigPda), txPDA);

    transaction.add(cancelIx);

    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: true,
    });
    console.log('Transaction signature', signature);
    toast.loading('Confirming...', {
      id: 'transaction',
    });
    const sent = await waitForConfirmation(connection, [signature]);
    if (!sent.every((sent) => !!sent)) {
      throw `Unable to confirm transaction`;
    }
    await queryClient.invalidateQueries({queryKey: ['transactions']});
  };

  return (
    <Button
      disabled={!isTransactionReady || !access}
      onClick={() =>
        toast.promise(cancelTransaction, {
          id: 'transaction',
          loading: 'Loading...',
          success: 'Transaction cancelled.',
          error: (e) => `Failed to cancel: ${e}`,
        })
      }
      className="mr-2"
    >
      Cancel
    </Button>
  );
};

export default CancelButton;
