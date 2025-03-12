import {Connection, PublicKey, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {Button} from './ui/button';
import {useWallet} from '@solana/wallet-adapter-react';
import {useWalletModal} from '@solana/wallet-adapter-react-ui';
import {toast} from 'sonner';
import Squads from '@sqds/sdk';
import {useAccess} from "../lib/hooks/useAccess";

type RemoveMemberButtonProps = {
  rpcUrl: string;
  multisigPda: string;
  memberKey: string;
  programId: string;
};

const RemoveMemberButton = ({
                              rpcUrl,
                              multisigPda,
                              memberKey,
                              programId,
                            }: RemoveMemberButtonProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const access = useAccess();

  const member = new PublicKey(memberKey);

  const connection = new Connection(rpcUrl, {commitment: 'confirmed'});

  const removeMember = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      return;
    }

    const squads = Squads.endpoint(rpcUrl, wallet as any, {
      multisigProgramId: new PublicKey(programId),
    });

    const txBuilder = await squads.getTransactionBuilder(new PublicKey(multisigPda), 0);
    const [txInstructions, txPDA] = await (
      await txBuilder.withRemoveMember(new PublicKey(member))
    ).getInstructions();
    const activateIx = await squads.buildActivateTransaction(new PublicKey(multisigPda), txPDA);
    const approveIx = await squads.buildApproveTransaction(new PublicKey(multisigPda), txPDA);

    const message = new TransactionMessage({
      instructions: [...txInstructions, activateIx, approveIx],
      payerKey: wallet.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);

    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: true,
    });
    console.log('Transaction signature', signature);
    toast.loading('Confirming...', {
      id: 'transaction',
    });
    await connection.getSignatureStatuses([signature]);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };
  return (
    <Button
      disabled={!access}
      onClick={() =>
        toast.promise(removeMember, {
          id: 'transaction',
          loading: 'Submitting...',
          success: 'Remove Member action proposed.',
          error: (e) => `Failed to propose: ${e}`,
        })
      }
    >
      Remove
    </Button>
  );
};

export default RemoveMemberButton;
