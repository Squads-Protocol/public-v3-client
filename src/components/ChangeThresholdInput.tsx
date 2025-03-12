import {Button} from './ui/button';
import {Input} from './ui/input';
import {useWallet} from '@solana/wallet-adapter-react';
import {useState} from 'react';
import {useWalletModal} from '@solana/wallet-adapter-react-ui';
import {Connection, PublicKey, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {toast} from 'sonner';
import Squads from '@sqds/sdk';
import {useAccess} from "../lib/hooks/useAccess";
import {useMultisigData} from "../hooks/useMultisigData";
import {useMultisig} from "../hooks/useServices";
import invariant from "invariant";
import {waitForConfirmation} from "../lib/transactionConfirmation";
import {useQueryClient} from "@tanstack/react-query";

type ChangeThresholdInputProps = {
  multisigPda: string;
  rpcUrl: string;
  programId: string;
};

const ChangeThresholdInput = ({multisigPda, rpcUrl, programId}: ChangeThresholdInputProps) => {
  const [threshold, setThreshold] = useState('');
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const access = useAccess();

  const {connection} = useMultisigData();
  const queryClient = useQueryClient();
  const {data: multisig} = useMultisig();
  const changeThreshold = async () => {
    invariant(multisig, 'Multisig not found');
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      return;
    }
    const thresholdNum = Number(threshold);
    if (thresholdNum > multisig.keys.length || thresholdNum < 1) {
      throw 'Invalid threshold'
    }
    const squads = Squads.endpoint(rpcUrl, wallet as any, {
      multisigProgramId: new PublicKey(programId),
    });

    const txBuilder = await squads.getTransactionBuilder(new PublicKey(multisigPda), 0);
    const [txInstructions, txPDA] = await (
      await txBuilder.withChangeThreshold(Number(threshold))
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
        placeholder={multisig ? multisig.threshold.toString() : ''}
        type="text"
        onChange={(e) => setThreshold(e.target.value)}
        className="mb-3"
      />
      <Button
        onClick={() =>
          toast.promise(changeThreshold, {
            id: 'transaction',
            loading: 'Loading...',
            success: 'Threshold change proposed.',
            error: (e) => `Failed to propose: ${e}`,
          })
        }
        disabled={!threshold || !access}
      >
        Change Threshold
      </Button>
    </div>
  );
};

export default ChangeThresholdInput;
