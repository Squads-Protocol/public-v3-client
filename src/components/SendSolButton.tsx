import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from './ui/button';
import {useState} from 'react';
import {useWallet} from '@solana/wallet-adapter-react';
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {useWalletModal} from '@solana/wallet-adapter-react-ui';
import {Input} from './ui/input';
import {toast} from 'sonner';
import {isPublickey} from '@/lib/isPublickey';
import {useMultisigData} from '@/hooks/useMultisigData';
import {useQueryClient} from '@tanstack/react-query';
import {createSquadTransactionInstructions} from '@/lib/createSquadTransactionInstructions';
import {useAccess} from "../lib/hooks/useAccess";
import {waitForConfirmation} from "../lib/transactionConfirmation";

type SendSolProps = {
  multisigPda: string;
};

const SendSol = ({multisigPda}: SendSolProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState('');
  const {connection, multisigVault, rpcUrl, programId} = useMultisigData();
  const queryClient = useQueryClient();
  const parsedAmount = parseFloat(amount);
  const isAmountValid = !isNaN(parsedAmount) && parsedAmount > 0;
  const access = useAccess();

  const transfer = async () => {
    if (!wallet.publicKey || !multisigVault) {
      return;
    }

    const transferInstruction = SystemProgram.transfer({
      fromPubkey: multisigVault,
      toPubkey: new PublicKey(recipient),
      lamports: parsedAmount * LAMPORTS_PER_SOL,
    });

    const instructions = await createSquadTransactionInstructions({
      wallet,
      multisigPda: new PublicKey(multisigPda),
      ixs: [transferInstruction],
      rpcUrl,
      programId,
    });

    const blockhash = (await connection.getLatestBlockhash()).blockhash;

    const message = new TransactionMessage({
      instructions,
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash,
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
      throw `Unable to confirm ${sent.length} transactions`;
    }
    await queryClient.invalidateQueries({queryKey: ['transactions']});
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          disabled={!access}
          onClick={(e) => {
            if (!wallet.publicKey) {
              e.preventDefault();
              walletModal.setVisible(true);
              return;
            }
          }}
        >
          Send SOL
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer SOL</DialogTitle>
          <DialogDescription>
            Create a proposal to transfer SOL to another address.
          </DialogDescription>
        </DialogHeader>
        <Input placeholder="Recipient" type="text" onChange={(e) => setRecipient(e.target.value)}/>
        {isPublickey(recipient) ? null : <p className="text-xs">Invalid recipient address</p>}
        <Input placeholder="Amount" type="number" onChange={(e) => setAmount(e.target.value)}/>
        {!isAmountValid && amount.length > 0 && (
          <p className="text-xs text-red-500">Invalid amount</p>
        )}
        <Button
          onClick={() =>
            toast.promise(transfer, {
              id: 'transaction',
              loading: 'Loading...',
              success: 'Transfer proposed.',
              error: (e) => `Failed to propose: ${e}`,
            })
          }
          disabled={!isPublickey(recipient) || !access}
        >
          Transfer
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default SendSol;
