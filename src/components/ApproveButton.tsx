'use client';
import {PublicKey, Transaction} from '@solana/web3.js';
import {Button} from './ui/button';
import {useWallet} from '@solana/wallet-adapter-react';
import {useWalletModal} from '@solana/wallet-adapter-react-ui';
import {toast} from 'sonner';
import {useMultisigData} from '@/hooks/useMultisigData';
import {useQueryClient} from '@tanstack/react-query';
import Squads, {getTxPDA} from '@sqds/sdk';
import BN from 'bn.js';
import {useAccess} from "../lib/hooks/useAccess";

type ApproveButtonProps = {
  disabled: boolean;
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
};

const ApproveButton = ({
                         multisigPda,
                         transactionIndex,
                         proposalStatus,
                         programId,
                         disabled = false
                       }: ApproveButtonProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const validKinds = ['Active', 'Draft'];
  const isKindValid = validKinds.includes(proposalStatus);
  const {connection, rpcUrl} = useMultisigData();
  const queryClient = useQueryClient();
  const access = useAccess();

  const approveProposal = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      return;
    }

    if (!isKindValid) {
      toast.error("You can't reject this proposal.");
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

    if (proposalStatus === 'Draft')
      transaction.add(await squads.buildActivateTransaction(new PublicKey(multisigPda), txPDA));

    transaction.add(await squads.buildApproveTransaction(new PublicKey(multisigPda), txPDA));

    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: true,
    });
    console.log('Transaction signature', signature);
    toast.loading('Confirming...', {
      id: 'transaction',
    });
    await connection.getSignatureStatuses([signature]);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await queryClient.invalidateQueries({queryKey: ['transactions']});
  };

  return (
    <Button
      disabled={!isKindValid || !access || disabled}
      onClick={() =>
        toast.promise(approveProposal, {
          id: 'transaction',
          loading: 'Loading...',
          success: 'Transaction approved.',
          error: (e) => `Failed to approve: ${e}`,
        })
      }
      className="mr-2"
    >
      Approve
    </Button>
  );
};

export default ApproveButton;
