'use client';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {useWallet} from '@solana/wallet-adapter-react';
import {useState} from 'react';
import {useWalletModal} from '@solana/wallet-adapter-react-ui';
import {
  AccountMeta,
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
import {waitForConfirmation} from "../lib/transactionConfirmation";
import {useQueryClient} from "@tanstack/react-query";
import {SimplifiedProgramInfo} from "../hooks/useProgram";

type ChangeUpgradeAuthorityInputProps = {
  programInfos: SimplifiedProgramInfo;
};

const ChangeUpgradeAuthorityInput = ({
                                       programInfos
                                     }: ChangeUpgradeAuthorityInputProps) => {
  const [newAuthority, setNewAuthority] = useState('');
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const {multisigVault, connection, multisigAddress, rpcUrl, programId} = useMultisigData();
  const access = useAccess();
  const queryClient = useQueryClient();

  const changeUpgradeAuth = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      return;
    }

    if (!multisigVault) {
      throw 'Multisig vault not found';
    }
    if (!multisigAddress) {
      throw 'Multisig not found';
    }

    const upgradeData = Buffer.alloc(4);
    upgradeData.writeInt32LE(4, 0);

    const keys: AccountMeta[] = [
      {
        pubkey: new PublicKey(programInfos.programDataAddress),
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
      multisigPda: new PublicKey(multisigAddress),
      ixs: [
        new TransactionInstruction({
          programId: new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'),
          data: upgradeData,
          keys,
        }),
      ],
      rpcUrl,
      programId,
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
    const sent = await waitForConfirmation(connection, [signature]);
    if (!sent.every((sent) => !!sent)) {
      throw `Unable to confirm transaction`;
    }
    await queryClient.invalidateQueries({queryKey: ['transactions']});

  };
  return (
    <div>
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
        disabled={
            !programId ||
            !isPublickey(newAuthority) ||
            !isPublickey(programInfos.programAddress) ||
            !isPublickey(programInfos.authority)
        || !access}
      >
        Change Authority
      </Button>
    </div>
  );
};

export default ChangeUpgradeAuthorityInput;
