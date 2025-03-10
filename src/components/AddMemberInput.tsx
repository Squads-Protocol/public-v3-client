'use client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState } from 'react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { isPublickey } from '@/lib/isPublickey';
import Squads from '@sqds/sdk';

type AddMemberInputProps = {
  multisigPda: string;
  rpcUrl: string;
  programId: string;
};

const AddMemberInput = ({ multisigPda, rpcUrl, programId }: AddMemberInputProps) => {
  const [member, setMember] = useState('');
  const wallet = useWallet();
  const walletModal = useWalletModal();

  const connection = new Connection(rpcUrl, { commitment: 'confirmed' });

  const addMember = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      return;
    }

    const squads = Squads.endpoint(rpcUrl, wallet as any, {
      multisigProgramId: new PublicKey(programId),
    });

    const txBuilder = await squads.getTransactionBuilder(new PublicKey(multisigPda), 0);
    const [txInstructions, txPDA] = await (
      await txBuilder.withAddMember(new PublicKey(member))
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
    <div>
      <Input
        placeholder="Member Public Key"
        onChange={(e) => setMember(e.target.value)}
        className="mb-3"
      />
      <Button
        onClick={() =>
          toast.promise(addMember, {
            id: 'transaction',
            loading: 'Loading...',
            success: 'Add member action proposed.',
            error: (e) => `Failed to propose: ${e}`,
          })
        }
        disabled={!isPublickey(member)}
      >
        Add Member
      </Button>
    </div>
  );
};

export default AddMemberInput;
