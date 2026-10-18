'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { syncAccount } from '@/lib/syncClient';
import { cn } from '@/lib/utils';

type Account = { id: string; username: string; platform: string };

// Sync right from the Overview: every account in the current selection, one after another
export function SyncNowButton({ accounts, syncedAgo, stale }: { accounts: Account[]; syncedAgo: string | null; stale?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<{ index: number; username: string } | null>(null);

  if (accounts.length === 0) return null;

  const run = async () => {
    for (const [index, a] of accounts.entries()) {
      setStep({ index, username: a.username });
      await syncAccount(a.id, `@${a.username}`, a.platform === 'youtube' ? 'subscribers' : 'followers');
    }
    setStep(null);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={run}
        disabled={step !== null}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white text-[#0A0A0F] text-[13px] font-bold hover:scale-[1.03] active:scale-[0.97] transition-transform disabled:opacity-80"
      >
        <RefreshCw className={cn('w-4 h-4', step && 'animate-spin')} />
        {step ? `Syncing @${step.username}${accounts.length > 1 ? ` (${step.index + 1}/${accounts.length})` : ''}...` : 'Sync now'}
      </button>
      {syncedAgo && (
        <span className={cn('text-[12px]', stale ? 'font-bold text-[#FFE08A]' : 'text-white/80')} title={stale ? 'Over a day old. Sync now, or check Status if it keeps failing.' : undefined}>
          {stale ? '⚠ ' : ''}Last synced {syncedAgo}
        </span>
      )}
    </div>
  );
}
