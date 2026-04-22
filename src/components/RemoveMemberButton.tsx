import {Connection, PublicKey, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {Button} from './ui/button';
import {useWallet} from '@solana/wallet-adapter-react';
import {useWalletModal} from '@solana/wallet-adapter-react-ui';
import {useState} from 'react';
import {toast} from 'sonner';
import Squads from '@sqds/sdk';
import {useAccess} from "../lib/hooks/useAccess";
import {useMultisigData} from "../hooks/useMultisigData";
import {sendAndConfirm} from "../lib/sendAndConfirm";
import {useQueryClient} from "@tanstack/react-query";
import {useNavigate} from 'react-router-dom';

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
  const {connection} = useMultisigData();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const member = new PublicKey(memberKey);
  const queryClient = useQueryClient();
  
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

    setIsLoading(true);
    try {
      await sendAndConfirm(connection, transaction, wallet, 'Remove member proposed.');
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['transactions']}),
        queryClient.invalidateQueries({queryKey: ['multisig']}),
      ]);
      navigate('/transactions');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Button
      disabled={!access || isLoading}
      onClick={() => removeMember().catch(() => {})}
    >
      Remove
    </Button>
  );
};

export default RemoveMemberButton;
