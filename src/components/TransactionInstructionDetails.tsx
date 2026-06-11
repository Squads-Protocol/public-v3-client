import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import Squads from '@sqds/sdk';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMultisigData } from '@/hooks/useMultisigData';
import { TransactionObject } from '@/hooks/useServices';
import {
  decodeV3Transaction,
  type DecodedInstruction,
} from '@/lib/transaction/decodeV3Transaction';
import {
  recognizeConfigAction,
  formatConfigActionKind,
  type ConfigAction,
} from '@/lib/transaction/recognizeConfigAction';
import { cn } from '@/lib/utils';

interface Props {
  transaction: TransactionObject;
}

function getStatusText(status: Record<string, unknown>): string {
  const key = Object.keys(status)[0] ?? 'Unknown';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export default function TransactionInstructionDetails({ transaction }: Props) {
  const { connection, rpcUrl, programId } = useMultisigData();
  const wallet = useWallet();
  const transactionPda = transaction.address.toBase58();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['txDetails', transactionPda],
    queryFn: () => {
      const squads = Squads.endpoint(rpcUrl, wallet as never, {
        multisigProgramId: programId,
      });
      return decodeV3Transaction(
        squads,
        transaction.address,
        programId,
        transaction.account
      );
    },
    retry: false,
    staleTime: 60_000,
    // Suppress the "connection unused" lint — useMultisigData() also returns it,
    // but Squads constructs its own Connection from rpcUrl above.
    enabled: !!connection,
  });

  const leftContent = (() => {
    if (isLoading) {
      return <div className="p-4 text-sm text-muted-foreground">Loading instructions...</div>;
    }
    if (isError || !data) {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          Unable to decode transaction instructions.
        </div>
      );
    }
    return (
      <InstructionList
        instructions={data.instructions}
        multisigProgramId={programId}
        executedIndex={data.executedIndex}
      />
    );
  })();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
      <div className="min-w-0">{leftContent}</div>
      <div className="min-w-0">
        <ProposalPanel transaction={transaction} />
      </div>
    </div>
  );
}

// ── Right panel: voting / proposal data ───────────────────────────────────────

function ProposalPanel({ transaction }: { transaction: TransactionObject }) {
  const account = transaction.account;
  const approved = account.approved as PublicKey[];
  const rejected = account.rejected as PublicKey[];
  const cancelled = account.cancelled as PublicKey[];

  return (
    <div className="p-4 space-y-4 text-xs">
      <div className="space-y-1">
        <span className="text-muted-foreground text-sm">Proposal Status</span>
        <div className="font-medium">{getStatusText(account.status as Record<string, unknown>)}</div>
      </div>

      <div className="space-y-1">
        <span className="text-muted-foreground text-sm">Authority Index</span>
        <div className="font-medium">{Number(account.authorityIndex)}</div>
      </div>

      <VoterList label="Approved" voters={approved} accent="green" />
      <VoterList label="Rejected" voters={rejected} accent="red" />
      {cancelled.length > 0 && (
        <VoterList label="Cancelled" voters={cancelled} accent="neutral" />
      )}
    </div>
  );
}

function VoterList({
  label,
  voters,
  accent,
}: {
  label: string;
  voters: PublicKey[];
  accent: 'green' | 'red' | 'neutral';
}) {
  const accentClass = {
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    neutral: 'text-muted-foreground',
  }[accent];

  return (
    <div className="space-y-1">
      <div className={cn('font-medium', accentClass)}>
        {label} ({voters.length})
      </div>
      {voters.length === 0 ? (
        <div className="text-muted-foreground">None</div>
      ) : (
        <div className="space-y-0.5">
          {voters.map((pk) => (
            <div key={pk.toBase58()} className="font-mono break-all">
              {pk.toBase58()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Left panel: instruction list ──────────────────────────────────────────────

function InstructionList({
  instructions,
  multisigProgramId,
  executedIndex,
}: {
  instructions: DecodedInstruction[];
  multisigProgramId: PublicKey;
  executedIndex: number;
}) {
  if (instructions.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No instructions found.</div>;
  }
  return (
    <div className="p-4 space-y-3">
      {instructions.map((ix) => {
        const action = recognizeConfigAction(ix, multisigProgramId);
        const label = `Instruction ${ix.index}`;
        const isExecuted = ix.executed || ix.index <= executedIndex;
        return action ? (
          <ConfigActionCard key={ix.index} action={action} label={label} executed={isExecuted} />
        ) : (
          <InstructionCard key={ix.index} ix={ix} label={label} executed={isExecuted} />
        );
      })}
    </div>
  );
}

// ── Cards ─────────────────────────────────────────────────────────────────────

function ConfigActionCard({
  action,
  label,
  executed,
}: {
  action: ConfigAction;
  label: string;
  executed: boolean;
}) {
  return (
    <div className="rounded border border-border bg-muted/30 p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm">{label}</div>
        <ExecutedBadge executed={executed} />
      </div>
      <div className="text-muted-foreground text-xs uppercase tracking-wide">Config Action</div>
      <div className="font-medium">{formatConfigActionKind(action.kind)}</div>
      {action.fields.length > 0 && (
        <div className="space-y-1">
          {action.fields.map((f, i) => (
            <Field key={i} label={f.label} value={f.value} mono={f.mono} />
          ))}
        </div>
      )}
    </div>
  );
}

function InstructionCard({
  ix,
  label,
  executed,
}: {
  ix: DecodedInstruction;
  label: string;
  executed: boolean;
}) {
  return (
    <div className="rounded border border-border bg-muted/30 p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm">{label}</div>
        <ExecutedBadge executed={executed} />
      </div>
      <div className="space-y-1">
        <span className="text-muted-foreground">Program ID</span>
        <div className="font-mono break-all">{ix.programId}</div>
      </div>
      <DataField data={ix.data} />
      {ix.accounts.length > 0 && (
        <div className="space-y-1">
          <span className="text-muted-foreground">Accounts</span>
          <div className="space-y-1">
            {ix.accounts.map((acc, j) => (
              <div key={j} className="flex items-center gap-2 font-mono">
                <span className="break-all">{acc.address}</span>
                <div className="flex gap-1 shrink-0">
                  {acc.isSigner && (
                    <span className="rounded bg-yellow-500/20 px-1 text-yellow-600 dark:text-yellow-400">
                      signer
                    </span>
                  )}
                  {acc.isWritable && (
                    <span className="rounded bg-blue-500/20 px-1 text-blue-600 dark:text-blue-400">
                      writable
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const DATA_FORMATS = ['base64', 'base58', 'bytes'] as const;
type DataFormat = (typeof DATA_FORMATS)[number];

function DataField({ data }: { data: Uint8Array }) {
  const [format, setFormat] = useState<DataFormat>('base64');

  const encoded = (() => {
    if (data.length === 0) return '(empty)';
    if (format === 'base64') return Buffer.from(data).toString('base64');
    if (format === 'base58') return bs58.encode(data);
    return Array.from(data).join(', ');
  })();

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Data</span>
        <div className="flex rounded border border-border overflow-hidden">
          {DATA_FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={cn(
                'px-2 py-0.5 text-xs transition-colors',
                format === f
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="font-mono break-all">{encoded}</div>
    </div>
  );
}

function ExecutedBadge({ executed }: { executed: boolean }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-medium',
        executed
          ? 'bg-green-500/20 text-green-700 dark:text-green-300'
          : 'bg-muted text-muted-foreground'
      )}
    >
      {executed ? 'Executed' : 'Pending'}
    </span>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className={mono ? 'font-mono break-all' : ''}>{value}</span>
    </div>
  );
}
