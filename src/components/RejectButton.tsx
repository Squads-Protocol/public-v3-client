import {PublicKey, Transaction} from '@solana/web3.js';
import {Button} from './ui/button';
import {useWallet} from '@solana/wallet-adapter-react';
import {useWalletModal} from '@solana/wallet-adapter-react-ui';
import {toast} from 'sonner';
import {useMultisigData} from '@/hooks/useMultisigData';
import {useQueryClient} from '@tanstack/react-query';
import Squads, {getTxPDA} from '@sqds/sdk';
import BN from 'bn.js';
import {useAccess} from "../lib/hooks/useAccess";
import {sendAndConfirm} from "../lib/sendAndConfirm";

type RejectButtonProps = {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
  disabled: boolean;
};

const RejectButton = ({
                        multisigPda,
                        transactionIndex,
                        proposalStatus,
                        programId,
                        disabled = false
                      }: RejectButtonProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const access = useAccess();

  const {connection, rpcUrl} = useMultisigData();
  const queryClient = useQueryClient();

  const validKinds = ['Active'];
  const isKindValid = validKinds.includes(proposalStatus);

  const rejectTransaction = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      return;
    }

    if (!isKindValid) {
      toast.error("You can't reject this proposal.");
      return;
    }

    const squads = Squads.endpoint(rpcUrl, wallet as any, {
      multisigProgramId: new PublicKey(programId),
    });

    const [txPDA] = getTxPDA(
      new PublicKey(multisigPda),
      new BN(transactionIndex),
      new PublicKey(programId)
    );

    const transaction = new Transaction();

    if (proposalStatus === 'Draft')
      transaction.add(await squads.buildActivateTransaction(new PublicKey(multisigPda), txPDA));

    transaction.add(await squads.buildRejectTransaction(new PublicKey(multisigPda), txPDA));

    await sendAndConfirm(connection, transaction, wallet, 'Transaction rejected.');
    await queryClient.invalidateQueries({queryKey: ['transactions']});
  };

  return (
    <Button
      disabled={!isKindValid || !access || disabled}
      onClick={() => rejectTransaction().catch(() => {})}
      className="mr-2"
    >
      Reject
    </Button>
  );
};

export default RejectButton;
