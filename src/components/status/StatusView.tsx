'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, CircleAlert, CircleX, RefreshCw } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { syncAccount } from '@/lib/syncClient';
import { STATUS_CHANGED, STATUS_URL, type AccountHealth, type AppStatus } from '@/lib/status';
import { formatRelativeTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';

type Tone = 'ok' | 'warn' | 'bad';

const PROBLEM_TEXT: Record<AccountHealth['problems'][number], string> = {
  disconnected: 'Disconnected: numbers have stopped updating',
  token_expired: 'Instagram access has expired',
  token_expiring: 'Instagram access runs out within a week (a sync renews it)',
  sync_failed: 'The last sync failed',
};

function Dot({ tone }: { tone: Tone }) {
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'warn' ? CircleAlert : CircleX;
  return <Icon className={cn('w-5 h-5 shrink-0', tone === 'ok' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : 'text-rose-400')} />;
}

function Row({ tone, title, detail, action }: { tone: Tone; title: string; detail?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-t border-ink/[0.05] first:border-t-0">
      <Dot tone={tone} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {detail && <div className="text-[12px] text-muted-foreground mt-0.5 break-words">{detail}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

const pill = 'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-[12px] font-bold hover:bg-ink/[0.12] disabled:opacity-50';

// One place to see whether every connection, the AI and the daily sync are healthy, and fix what is not
export function StatusView() {
  const { data, refresh } = useCachedJson<AppStatus>(STATUS_URL);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener(STATUS_CHANGED, onChange);
    return () => window.removeEventListener(STATUS_CHANGED, onChange);
  }, [refresh]);

  if (data === undefined) return <div className="h-96 rounded-[30px] bg-card animate-pulse" />;
  if (!data) return <p className="text-sm text-muted-foreground">Could not load the status.</p>;

  const sync = async (a: AccountHealth) => {
    setSyncing(a.id);
    await syncAccount(a.id, `@${a.username}`, a.platform === 'youtube' ? 'subscribers' : 'followers');
    setSyncing(null);
  };

  const issues = data.accounts.reduce((n, a) => n + a.problems.length, 0) + (data.ai ? 0 : 1);
  const hasYouTube = data.accounts.some((a) => a.platform === 'youtube');

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">Status</h1>
        <p className="text-[15px] text-muted-foreground mt-3">Every connection InstaSage relies on, and what to do when one breaks</p>
      </div>

      <section className={cn('rounded-[30px] p-5 sm:p-6 flex items-center gap-4 border', issues ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20')}>
        <Dot tone={issues ? 'warn' : 'ok'} />
        <div className="flex-1">
          <p className="font-bold">{issues ? `${issues} thing${issues === 1 ? '' : 's'} need${issues === 1 ? 's' : ''} attention` : 'Everything is working'}</p>
          <p className="text-[12px] text-muted-foreground">Posts, insights and competitors refresh every morning, and follower counts whenever you open the app.</p>
        </div>
        <button type="button" onClick={() => refresh()} className={pill} aria-label="Check again"><RefreshCw className="w-3.5 h-3.5" /> Check</button>
      </section>

      <section className="rounded-[30px] bg-card border border-ink/[0.05] p-5 sm:p-6">
        <h2 className="text-lg font-bold mb-1">Accounts</h2>
        {data.accounts.length === 0 && <Row tone="warn" title="No accounts connected" action={<Link href="/accounts" className={pill}>Connect</Link>} />}
        {data.accounts.map((a) => {
          const tone: Tone = a.problems.some((p) => p === 'disconnected' || p === 'token_expired') ? 'bad' : a.problems.length ? 'warn' : 'ok';
          const reconnect = a.platform === 'instagram' && a.problems.some((p) => p === 'disconnected' || p === 'token_expired');
          return (
            <Row
              key={a.id}
              tone={tone}
              title={`@${a.username} · ${a.platform === 'youtube' ? 'YouTube' : 'Instagram'}`}
              detail={
                <>
                  {a.problems.map((p) => <p key={p}>{PROBLEM_TEXT[p]}{p === 'sync_failed' && a.lastJob?.error ? `: ${a.lastJob.error}` : ''}</p>)}
                  <p>Last synced {formatRelativeTime(a.lastSyncedAt).toLowerCase()}{a.tokenExpiresAt ? ` · access valid until ${new Date(a.tokenExpiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}` : ''}</p>
                </>
              }
              action={reconnect
                ? <a href="/api/connect/instagram" className={pill}>Reconnect</a>
                : <button type="button" onClick={() => sync(a)} disabled={syncing === a.id} className={pill}><RefreshCw className={cn('w-3.5 h-3.5', syncing === a.id && 'animate-spin')} /> {syncing === a.id ? 'Syncing' : 'Sync now'}</button>}
            />
          );
        })}
      </section>

      <section className="rounded-[30px] bg-card border border-ink/[0.05] p-5 sm:p-6">
        <h2 className="text-lg font-bold mb-1">Services</h2>
        <Row
          tone={data.ai ? 'ok' : 'bad'}
          title={data.ai ? `AI: ${data.ai.label}${data.ai.model ? ` (${data.ai.model})` : ''}` : 'No AI key saved'}
          detail={data.ai ? `${data.ai.saved.length} provider${data.ai.saved.length === 1 ? '' : 's'} saved${data.ai.saved.length > 1 ? ', the others step in if the active one is down' : ''}` : 'Insights, ideas and chat need one. Gemini has a free tier.'}
          action={<Link href="/settings#ai" className={pill}>{data.ai ? 'Manage' : 'Add key'}</Link>}
        />
        <Row
          tone={data.facebook ? (data.facebook.expired ? 'bad' : 'ok') : 'warn'}
          title={data.facebook ? `Competitor tracking via @${data.facebook.igUsername}` : 'Competitor tracking not connected'}
          detail={data.facebook?.expired ? 'Facebook access has expired. Reconnect on the Competitors page.' : data.facebook?.expiresAt ? `Facebook access valid until ${new Date(data.facebook.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}` : data.facebook ? undefined : 'Optional. Needed only for the Competitors page.'}
          action={<Link href="/competitors" className={pill}>Open</Link>}
        />
        {hasYouTube && (
          <Row tone={data.youtubeKey ? 'ok' : 'bad'} title={data.youtubeKey ? 'YouTube API key saved' : 'No YouTube API key'} action={<Link href="/accounts" className={pill}>Manage</Link>} />
        )}
        <Row tone={data.timezone ? 'ok' : 'warn'} title={`Timezone: ${data.timezone ?? 'not set yet'}`} detail="Used by charts, reports, the AI and the daily sync" action={<Link href="/settings#timezone" className={pill}>Change</Link>} />
      </section>

      <section className="rounded-[30px] bg-card border border-ink/[0.05] p-5 sm:p-6">
        <h2 className="text-lg font-bold mb-3">Recent syncs</h2>
        {data.jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No syncs yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.jobs.map((j) => (
              <li key={j.id} className="flex items-start gap-2.5 text-[13px]">
                <span className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', j.status === 'completed' ? 'bg-emerald-400' : j.status === 'failed' ? 'bg-rose-400' : 'bg-amber-400')} />
                <span className="flex-1 min-w-0">
                  <span className="font-semibold">@{j.username}</span>
                  <span className="text-muted-foreground"> · {j.status}{j.seconds != null ? ` in ${j.seconds}s` : ''}</span>
                  {j.error && <span className="block text-[12px] text-rose-400 break-words">{j.error}</span>}
                </span>
                <span className="text-[12px] text-muted-foreground shrink-0">{formatRelativeTime(j.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.version && <p className="text-[11px] text-muted-foreground">Version {data.version}</p>}
    </div>
  );
}
