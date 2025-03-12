'use client';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {useWallet} from '@solana/wallet-adapter-react';
import {useState} from 'react';
import {useWalletModal} from '@solana/wallet-adapter-react-ui';
import {
  AccountMeta,
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {toast} from 'sonner';
import {isPublickey} from '@/lib/isPublickey';
import {createSquadTransactionInstructions} from '@/lib/createSquadTransactionInstructions';
import {useMultisigData} from '@/hooks/useMultisigData';
import {useAccess} from "../lib/hooks/useAccess";

type ChangeUpgradeAuthorityInputProps = {
  multisigPda: string;
  rpcUrl: string;
  globalProgramId: string;
};

const ChangeUpgradeAuthorityInput = ({
                                       multisigPda,
                                       rpcUrl,
                                       globalProgramId,
                                     }: ChangeUpgradeAuthorityInputProps) => {
  const [programId, setProgramId] = useState('');
  const [newAuthority, setNewAuthority] = useState('');
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const {multisigVault} = useMultisigData();
  const access = useAccess();

  const connection = new Connection(rpcUrl, {commitment: 'confirmed'});

  const changeUpgradeAuth = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      return;
    }

    if (!multisigVault) return;

    const upgradeData = Buffer.alloc(4);
    upgradeData.writeInt32LE(4, 0);

    const [programDataAddress] = PublicKey.findProgramAddressSync(
      [new PublicKey(programId).toBuffer()],
      new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')
    );
    const keys: AccountMeta[] = [
      {
        pubkey: programDataAddress,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: multisigVault,
        isWritable: false,
        isSigner: true,
      },
      {
        pubkey: new PublicKey(newAuthority),
        isWritable: false,
        isSigner: false,
      },
    ];

    const instructions = await createSquadTransactionInstructions({
      wallet,
      multisigPda: new PublicKey(multisigPda),
      ixs: [
        new TransactionInstruction({
          programId: new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'),
          data: upgradeData,
          keys,
        }),
      ],
      rpcUrl,
      programId: new PublicKey(globalProgramId),
    });

    const message = new TransactionMessage({
      instructions,
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
        placeholder="Program ID"
        type="text"
        onChange={(e) => setProgramId(e.target.value)}
        className="mb-3"
      />
      <Input
        placeholder="New Program Authority"
        type="text"
        onChange={(e) => setNewAuthority(e.target.value)}
        className="mb-3"
      />
      <Button
        onClick={() =>
          toast.promise(changeUpgradeAuth, {
            id: 'transaction',
            loading: 'Loading...',
            success: 'Upgrade authority change proposed.',
            error: (e) => `Failed to propose: ${e}`,
          })
        }
        disabled={!isPublickey(programId) || !isPublickey(newAuthority) || !access}
      >
        Change Authority
      </Button>
    </div>
  );
};

export default ChangeUpgradeAuthorityInput;
