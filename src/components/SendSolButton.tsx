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
import {createSquadTransactionInstructions} from '@/lib/createSquadTransactionInstructions';
import {useAccess} from "../lib/hooks/useAccess";
import {sendAndConfirm} from "../lib/sendAndConfirm";
import {useInvalidateMultisig} from "../lib/hooks/useInvalidateMultisig";
import {parseAmountToBaseUnits} from "../lib/amount";

type SendSolProps = {
  multisigPda: string;
};

const SendSol = ({multisigPda}: SendSolProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState('');
  const {connection, multisigVault, rpcUrl, programId} = useMultisigData();
  const invalidateMultisig = useInvalidateMultisig();
  
  // PC3-1 Fix: SOL has 9 decimals; parse exactly instead of going through a float.
  const parsedLamports = parseAmountToBaseUnits(amount, 9);
  const isAmountValid = parsedLamports !== null && parsedLamports > BigInt(0);
  
  const access = useAccess();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const closeDialog = () => setIsOpen(false);
  const resetForm = () => {
    setAmount('');
    setRecipient('');
  };
  
  const transfer = async () => {
    if (!wallet.publicKey || !multisigVault) {
      return;
    }
    if (parsedLamports === null || parsedLamports <= BigInt(0)) {
      throw new Error('Invalid amount');
    }

    const transferInstruction = SystemProgram.transfer({
      fromPubkey: multisigVault,
      toPubkey: new PublicKey(recipient),
      lamports: parsedLamports, // PC3-1 Fix: Use the exact BigInt base units
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

    setIsLoading(true);
    try {
      await sendAndConfirm(connection, transaction, wallet, 'Transfer proposed.');
      await invalidateMultisig();
      resetForm();
      closeDialog();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsOpen(open); }}>
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
          onClick={() => transfer().catch(() => {})}
          disabled={!isPublickey(recipient) || !access || !isAmountValid || isLoading}
        >
          Transfer
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default SendSol;