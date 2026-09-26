import Link from 'next/link';
import { KeyRound, RefreshCw, TriangleAlert } from 'lucide-react';

// Explains why AI output is missing and what to do about it
export function AiNotice({ code, message }: { code?: string; message: string }) {
  const Icon = code === 'no_key' ? KeyRound : code === 'no_data' ? RefreshCw : TriangleAlert;
  const action =
    code === 'no_key' ? { href: '/settings#ai', label: 'Add an AI key' } :
    code === 'no_data' ? { href: '/accounts', label: 'Go to Accounts' } : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-dashed border-border bg-secondary/10">
      <Icon className="w-5 h-5 text-indigo-400 shrink-0" />
      <p className="text-sm text-muted-foreground flex-1">{message}</p>
      {action && (
        <Link href={action.href} className="text-xs font-medium text-indigo-400 hover:underline shrink-0">
          {action.label}
        </Link>
      )}
    </div>
  );
}
