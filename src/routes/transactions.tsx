import { Table, TableCaption, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Suspense } from 'react';
import CreateTransaction from '@/components/CreateTransactionButton';
import TransactionTable from '@/components/TransactionTable';
import { useMultisig, useTransactions } from '@/hooks/useServices';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useNavigate } from 'react-router';
import { useLocation } from 'react-router-dom';

const TRANSACTIONS_PER_PAGE = 10;

export default function TransactionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageParam = new URLSearchParams(location.search).get('page');
  let page = pageParam ? parseInt(pageParam, 10) : 1;
  if (page < 1) {
    page = 1;
  }

  const { multisigAddress, programId } = useMultisigData();

  const { data } = useMultisig();

  const totalTransactions = Number(data ? data.transactionIndex : 0);
  const totalPages = Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE);

  const startIndex = totalTransactions - (page - 1) * TRANSACTIONS_PER_PAGE;
  const endIndex = Math.max(startIndex - TRANSACTIONS_PER_PAGE + 1, 1);

  const { data: latestTransactions } = useTransactions(startIndex, endIndex);

  const transactions = latestTransactions || [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <CreateTransaction />
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <Table>
          <TableCaption>A list of your recent transactions.</TableCaption>
          <TableCaption>
            Page: {page} of {totalPages}
          </TableCaption>

          <TableHeader>
            <TableRow>
              <TableHead>Index</TableHead>
              <TableHead>Public Key</TableHead>
              <TableHead>Proposal Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <Suspense fallback={<div>Loading...</div>}>
            <TransactionTable
              multisigPda={multisigAddress!}
              transactions={transactions}
              programId={programId!.toBase58()}
            />
          </Suspense>
        </Table>
      </Suspense>

      <Pagination>
        <PaginationContent>
          {page > 1 && (
            <PaginationPrevious
              to={`/transactions?page=${page - 1}`}
              onClick={() => navigate(`/transactions?page=${page - 1}`)}
            />
          )}
          {page < totalPages && (
            <PaginationNext
              to={`/transactions?page=${page + 1}`}
              onClick={() => navigate(`/transactions?page=${page + 1}`)}
            />
          )}
        </PaginationContent>
      </Pagination>
    </div>
  );
}
