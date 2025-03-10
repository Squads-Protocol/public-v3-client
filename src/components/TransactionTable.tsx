import ApproveButton from './ApproveButton';
import ExecuteButton from './ExecuteButton';
import RejectButton from './RejectButton';
import { TableBody, TableCell, TableRow } from './ui/table';
import { Link } from 'react-router-dom';
import { useRpcUrl } from '@/hooks/useSettings';
import { TransactionObject } from '@/hooks/useServices';
import { DEFAULT_MULTISIG_PROGRAM_ID, TransactionAccount } from '@sqds/sdk';
import CancelButton from './CancelButton';

interface ActionButtonsProps {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
}

export default function TransactionTable({
  multisigPda,
  transactions,
  programId,
}: {
  multisigPda: string;
  transactions: TransactionObject[];
  programId?: string;
}) {
  const { rpcUrl } = useRpcUrl();
  if (transactions.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={5}>No transactions found.</TableCell>
        </TableRow>
      </TableBody>
    );
  }

  const getStatusText = (account: TransactionAccount) => {
    const statusKeys = Object.keys(account.status);
    const status = statusKeys[0];
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <TableBody>
      {transactions.map((transaction, index) => {
        return (
          <TableRow key={index}>
            <TableCell>{transaction.account.transactionIndex}</TableCell>
            <TableCell className="text-blue-500">
              <Link to={createSolanaExplorerUrl(transaction.address.toBase58(), rpcUrl!)}>
                {transaction.address.toBase58()}
              </Link>
            </TableCell>
            <TableCell>{getStatusText(transaction.account)}</TableCell>
            <TableCell>
              <ActionButtons
                multisigPda={multisigPda!}
                transactionIndex={Number(transaction.account.transactionIndex)}
                proposalStatus={getStatusText(transaction.account)}
                programId={programId ? programId : DEFAULT_MULTISIG_PROGRAM_ID.toBase58()}
              />
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  );
}

function ActionButtons({
  multisigPda,
  transactionIndex,
  proposalStatus,
  programId,
}: ActionButtonsProps) {
  return (
    <>
      {proposalStatus === 'ExecuteReady' ? (
        <>
          <CancelButton
            multisigPda={multisigPda}
            transactionIndex={transactionIndex}
            proposalStatus={proposalStatus}
            programId={programId}
          />
          <ExecuteButton
            multisigPda={multisigPda}
            transactionIndex={transactionIndex}
            proposalStatus={proposalStatus}
            programId={programId}
          />
        </>
      ) : (
        <>
          <ApproveButton
            multisigPda={multisigPda}
            transactionIndex={transactionIndex}
            proposalStatus={proposalStatus}
            programId={programId}
          />
          <RejectButton
            multisigPda={multisigPda}
            transactionIndex={transactionIndex}
            proposalStatus={proposalStatus}
            programId={programId}
          />
        </>
      )}
    </>
  );
}

function createSolanaExplorerUrl(publicKey: string, rpcUrl: string): string {
  const baseUrl = 'https://explorer.solana.com/address/';
  const clusterQuery = '?cluster=custom&customUrl=';
  const encodedRpcUrl = encodeURIComponent(rpcUrl);

  return `${baseUrl}${publicKey}${clusterQuery}${encodedRpcUrl}`;
}
