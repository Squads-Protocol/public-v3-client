'use client';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {useWallet} from '@solana/wallet-adapter-react';
import {useState} from 'react';
import {useWalletModal} from '@solana/wallet-adapter-react-ui';
import {Connection, PublicKey, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {toast} from 'sonner';
import {isPublickey} from '@/lib/isPublickey';
import Squads from '@sqds/sdk';
import {useAccess} from "../lib/hooks/useAccess";
import {waitForConfirmation} from "../lib/transactionConfirmation";
import {useQueryClient} from "@tanstack/react-query";
import {useMultisigData} from "../hooks/useMultisigData";
import {useMultisig} from "../hooks/useServices";

type AddMemberInputProps = {
  multisigPda: string;
  rpcUrl: string;
  programId: string;
};

const AddMemberInput = ({multisigPda, rpcUrl, programId}: AddMemberInputProps) => {
  const [member, setMember] = useState('');
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const access = useAccess();
  const queryClient = useQueryClient();
  const {connection} = useMultisigData();
  const {data: multisig} = useMultisig();
  const addMember = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      return;
    }
    const newMember = new PublicKey(member);
    const exists = !!multisig?.keys.find((key) => key.equals(newMember));
    if (exists) {
      throw 'Member already exists';
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
    const sent = await waitForConfirmation(connection, [signature]);
    if (!sent.every((sent) => !!sent)) {
      throw `Unable to confirm transaction`;
    }
    await queryClient.invalidateQueries({queryKey: ['transactions']});
  };
  return (
    <div>
      <Input
        placeholder="Member Public Key"
        onChange={(e) => setMember(e.target.value.trim())}
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
        disabled={!isPublickey(member) || !access}
      >
        Add Member
      </Button>
    </div>
  );
};

export default AddMemberInput;
