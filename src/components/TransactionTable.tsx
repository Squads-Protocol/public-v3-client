import {useState} from 'react';
import ApproveButton from './ApproveButton';
import ExecuteButton from './ExecuteButton';
import RejectButton from './RejectButton';
import {TableBody, TableCell, TableRow} from './ui/table';
import {Link} from 'react-router-dom';
import {useRpcUrl} from '@/hooks/useSettings';
import {TransactionObject} from '@/hooks/useServices';
import {DEFAULT_MULTISIG_PROGRAM_ID, TransactionAccount} from '@sqds/sdk';
import CancelButton from './CancelButton';
import {useWallet} from "@solana/wallet-adapter-react";
import TransactionInstructionDetails from './TransactionInstructionDetails';
import {cn} from '@/lib/utils';

const TABLE_COLUMN_COUNT = 5;

interface ActionButtonsProps {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
  transaction: TransactionObject
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
  if (transactions.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={TABLE_COLUMN_COUNT}>No transactions found.</TableCell>
        </TableRow>
      </TableBody>
    );
  }

  const resolvedProgramId = programId ? programId : DEFAULT_MULTISIG_PROGRAM_ID.toBase58();

  return (
    <TableBody>
      {transactions.map((transaction) => (
        <TransactionRowItem
          key={transaction.address.toBase58()}
          transaction={transaction}
          multisigPda={multisigPda}
          programId={resolvedProgramId}
        />
      ))}
    </TableBody>
  );
}

function getStatusText(account: TransactionAccount) {
  const statusKeys = Object.keys(account.status);
  const status = statusKeys[0];
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function TransactionRowItem({
                              transaction,
                              multisigPda,
                              programId,
                            }: {
  transaction: TransactionObject;
  multisigPda: string;
  programId: string;
}) {
  const {rpcUrl} = useRpcUrl();
  const [isExpanded, setIsExpanded] = useState(false);
  const status = getStatusText(transaction.account);

  return (
    <>
      <TableRow>
        <TableCell className="w-8 pr-0">
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center justify-center rounded p-1 hover:bg-muted transition-colors"
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
            aria-expanded={isExpanded}
          >
            <EyeIcon
              className={cn(
                'h-4 w-4 transition-colors',
                isExpanded ? 'text-foreground' : 'text-muted-foreground'
              )}
            />
          </button>
        </TableCell>
        <TableCell>{transaction.account.transactionIndex}</TableCell>
        <TableCell className="text-blue-500">
          <Link to={createSolanaExplorerUrl(transaction.address.toBase58(), rpcUrl!)} target="_blank">
            {transaction.address.toBase58()}
          </Link>
        </TableCell>
        <TableCell>{status}</TableCell>
        <TableCell>
          <ActionButtons
            transaction={transaction}
            multisigPda={multisigPda}
            transactionIndex={Number(transaction.account.transactionIndex)}
            proposalStatus={status}
            programId={programId}
          />
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={TABLE_COLUMN_COUNT} className="p-0 bg-muted/20">
            <TransactionInstructionDetails transaction={transaction} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ActionButtons({
                         multisigPda,
                         transactionIndex,
                         proposalStatus,
                         programId,
                         transaction,
                       }: ActionButtonsProps) {
  const {publicKey} = useWallet();
  let alreadyApproved = false;
  let alreadyRejected = false;
  if (publicKey) {
    alreadyApproved = !!transaction.account.approved.find(a => a.equals(publicKey));
    alreadyRejected = !!transaction.account.rejected.find(r => r.equals(publicKey));
  }
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
            disabled={alreadyApproved}
            multisigPda={multisigPda}
            transactionIndex={transactionIndex}
            proposalStatus={proposalStatus}
            programId={programId}
          />
          <RejectButton
            disabled={alreadyRejected}
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

function EyeIcon({className}: {className?: string}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function createSolanaExplorerUrl(publicKey: string, rpcUrl: string): string {
  const baseUrl = 'https://explorer.solana.com/address/';
  const clusterQuery = '?cluster=custom&customUrl=';
  const encodedRpcUrl = encodeURIComponent(rpcUrl);

  return `${baseUrl}${publicKey}${clusterQuery}${encodedRpcUrl}`;
}
