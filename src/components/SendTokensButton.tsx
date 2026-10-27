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
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {useWallet} from '@solana/wallet-adapter-react';
import {PublicKey, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
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

type SendTokensProps = {
  tokenAccount: string;
  mint: string;
  decimals: number;
  multisigPda: string;
};

const SendTokens = ({tokenAccount, mint, decimals, multisigPda}: SendTokensProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState('');
  const access = useAccess();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const closeDialog = () => setIsOpen(false);
  const resetForm = () => {
    setAmount('');
    setRecipient('');
  };
  const {connection, multisigVault, rpcUrl, programId} = useMultisigData();

  const invalidateMultisig = useInvalidateMultisig();
  
  // PC3-1 Fix: Parse the amount with the mint's decimals using integer arithmetic
  const parsedTokenAmount = parseAmountToBaseUnits(amount, decimals);
  const isAmountValid = parsedTokenAmount !== null && parsedTokenAmount > BigInt(0);

  const transfer = async () => {
    if (!wallet.publicKey || !multisigVault) {
      return;
    }
    if (parsedTokenAmount === null || parsedTokenAmount <= BigInt(0)) {
      throw new Error('Invalid amount');
    }
    const recipientATA = getAssociatedTokenAddressSync(
      new PublicKey(mint),
      new PublicKey(recipient),
      true
    );

    const createRecipientATAInstruction = createAssociatedTokenAccountIdempotentInstruction(
      new PublicKey(multisigVault),
      recipientATA,
      new PublicKey(recipient),
      new PublicKey(mint)
    );

    const transferInstruction = createTransferCheckedInstruction(
      new PublicKey(tokenAccount),
      new PublicKey(mint),
      recipientATA,
      new PublicKey(multisigVault),
      parsedTokenAmount, // PC3-1 Fix: Use strictly parsed base units (BigInt)
      decimals
    );

    const instructions = await createSquadTransactionInstructions({
      wallet,
      multisigPda: new PublicKey(multisigPda),
      ixs: [createRecipientATAInstruction, transferInstruction],
      rpcUrl,
      programId,
    });

    const blockhash = (await connection.getLatestBlockhash()).blockhash;

    const message = new TransactionMessage({
      instructions: instructions,
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
          Send Tokens
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer tokens</DialogTitle>
          <DialogDescription>
            Create a proposal to transfer tokens to another address.
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

export default SendTokens;