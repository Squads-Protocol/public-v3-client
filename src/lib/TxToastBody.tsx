import {Check, Copy} from 'lucide-react';
import {useState, type ReactNode} from 'react';

type TxToastBodyProps = {
  label: string;
  signature?: string;
  progress?: string;
};

export const txToastBody = (props: TxToastBodyProps): ReactNode => (
  <TxToastBody {...props} />
);

export const TxToastBody = ({label, signature, progress}: TxToastBodyProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!signature) return;
    try {
      await navigator.clipboard.writeText(signature);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may be unavailable (insecure context); ignore silently.
    }
  };

  return (
    <div className="flex w-full items-start gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          {label}
          {progress ? <span className="ml-1 text-muted-foreground">{progress}</span> : null}
        </div>
        {signature ? (
          <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {signature}
          </div>
        ) : null}
      </div>
      {signature ? (
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy signature"
          className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  );
};
