import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import * as bs58 from 'bs58';
import {Button} from './ui/button';
import {useState} from 'react';
import {useWallet} from '@solana/wallet-adapter-react';
import {Message, PublicKey, TransactionInstruction} from '@solana/web3.js';
import {Input} from './ui/input';
import {toast} from 'sonner';
import {simulateEncodedTransaction} from '@/lib/transaction/simulateEncodedTransaction';
import {importTransaction} from '@/lib/transaction/importTransaction';
import {useMultisigData} from '@/hooks/useMultisigData';
import invariant from 'invariant';
import {useAccess} from "../lib/hooks/useAccess";

const CreateTransaction = () => {
  const wallet = useWallet();

  const [tx, setTx] = useState('');
  const [open, setOpen] = useState(false);

  const {connection, multisigAddress, programId, multisigVault} = useMultisigData();
  const access = useAccess();

  const getSampleMessage = async () => {
    invariant(programId, 'Program ID not found');
    invariant(multisigAddress, 'Multisig address not found. Please create a multisig first.');
    invariant(multisigVault, 'Multisig Vault address not found.');

    let memo = 'Hello from Solana land!';

    const dummyMessage = Message.compile({
      instructions: [
        new TransactionInstruction({
          keys: [
            {
              pubkey: wallet.publicKey as PublicKey,
              isSigner: true,
              isWritable: true,
            },
          ],
          data: Buffer.from(memo, 'utf-8'),
          programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        }),
      ],
      payerKey: multisigVault,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    });

    const encoded = bs58.default.encode(dummyMessage.serialize());

    setTx(encoded);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="h-10 px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md">
        Import Transaction
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Transaction</DialogTitle>
          <DialogDescription>
            Propose a transaction from a base58 encoded transaction message (not a transaction).
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Paste base58 encoded transaction..."
          type="text"
          defaultValue={tx}
          onChange={(e) => setTx(e.target.value)}
        />
        <div className="flex gap-2 items-center justify-end">
          <Button
            onClick={() => {
              toast('Note: Simulations may fail on alt-SVM', {
                description: 'Please verify via an explorer before submitting.',
              });
              toast.promise(simulateEncodedTransaction(tx, connection, wallet), {
                id: 'simulation',
                loading: 'Building simulation...',
                success: 'Simulation successful.',
                error: (e) => {
                  return `${e}`;
                },
              });
            }}
          >
            Simulate
          </Button>
          {multisigAddress && (
            <Button
              disabled={!access}
              onClick={() =>
                toast.promise(
                  importTransaction(tx, connection, multisigAddress, programId.toBase58(), wallet),
                  {
                    id: 'transaction',
                    loading: 'Building transaction...',
                    success: () => {
                      setOpen(false);
                      return 'Transaction proposed.';
                    },
                    error: (e) => `Failed to propose: ${e}`,
                  }
                )
              }
            >
              Import
            </Button>
          )}
        </div>
        <button
          onClick={() => getSampleMessage()}
          className="flex justify-end text-xs underline text-stone-400 hover:text-stone-200 cursor-pointer"
        >
          Click to use a sample memo for testing
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTransaction;
