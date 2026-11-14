'use client';

import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, CircleDashed, Copy } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { formatRelativeTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { QUEUE_URL, recentTick, type Queue } from '@/components/publish/PublishModal';

const noop = () => () => {};

function Step({ done, title, children }: { done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className={cn('flex gap-3 p-4 rounded-2xl border', done ? 'bg-emerald-500/[0.06] border-emerald-500/20' : 'bg-ink/[0.03] border-ink/[0.08]')}>
      {done ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" /> : <CircleDashed className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-bold">{title}</p>
        <div className="text-[13px] text-muted-foreground leading-relaxed space-y-2">{children}</div>
      </div>
    </li>
  );
}

const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`), () => toast.error('Could not copy', { description: 'Select the text instead.' }));

// The three things posting to Instagram needs, with where each one stands
export function PostingSettings() {
  const { data } = useCachedJson<Queue | null>(QUEUE_URL);
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => '');
  if (data === undefined) return <div className="h-40 rounded-2xl bg-ink/[0.04] animate-pulse" />;
  if (data === null) return <p role="alert" className="text-sm text-muted-foreground">This did not load. Check your connection and reload the page.</p>;
  const endpoint = `${origin}/api/cron/publish`;
  const ticking = recentTick(data);

  return (
    <ol className="space-y-2.5">
      <Step done={data.allowed} title="1. Allow InstaSage to post">
        <p>{data.allowed ? 'Allowed.' : 'Instagram asks you to log in once more and tick publish content. Comment replies stay on if you had them.'}</p>
        <p>If Instagram says the permission is invalid: in your Meta app, open Instagram, API setup with Instagram login, and add <b>instagram_business_content_publish</b> to the permissions. In Development mode it works for you without App Review.</p>
        <a href="/api/connect/instagram?publish=1" className="inline-flex items-center h-10 px-4 rounded-full bg-ink text-background text-[13px] font-bold">{data.allowed ? 'Allow again' : 'Allow posting'}</a>
      </Step>

      <Step done={data.uploads} title="2. Turn on file uploads (Vercel Blob)">
        {data.uploads ? <p>On. Photos and videos upload straight from your phone or computer, and are deleted once they are on Instagram.</p> : (
          <>
            <p>Instagram fetches each photo or video from a link, so files are kept briefly in Vercel Blob (free tier is plenty). In Vercel:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open the InstaSage project, then the <b>Storage</b> tab.</li>
              <li>Create a database, pick <b>Blob</b>, give it any name, and connect it to this project (all environments).</li>
              <li>Redeploy (Deployments, the latest one, Redeploy). That adds BLOB_READ_WRITE_TOKEN for you.</li>
            </ol>
            <p>Until then you can still post by pasting a public link to the file.</p>
          </>
        )}
      </Step>

      <Step done={ticking} title="3. Post scheduled posts on time (cron-job.org, free)">
        <p>{ticking ? `Working: last check ${formatRelativeTime(data.lastTick!.at).toLowerCase()}.` : data.lastTick ? `Last check ${formatRelativeTime(data.lastTick.at).toLowerCase()} (${data.lastTick.source === 'pinger' ? 'from the scheduler' : 'from the morning sync'}). Without the scheduler, posts go out when you open InstaSage or at the morning sync.` : 'Not set up. Without it, scheduled posts go out when you open InstaSage or at the morning sync.'}</p>
        {!data.cronSecret && <p className="text-amber-400 font-semibold">CRON_SECRET is not set in Vercel. Add any long random string as CRON_SECRET (Settings, Environment Variables), redeploy, then continue.</p>}
        <ol className="list-decimal pl-5 space-y-1">
          <li>Sign up at <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="underline">cron-job.org</a> and create a cronjob.</li>
          <li>
            URL:{' '}
            <code className="text-[12px] text-foreground break-all">{endpoint}</code>{' '}
            <button type="button" onClick={() => copy(endpoint, 'URL')} className="inline-flex items-center gap-1 text-indigo-400 font-semibold"><Copy className="w-3 h-3" /> copy</button>
          </li>
          <li>Schedule: every 5 minutes.</li>
          <li>Under Advanced, add a header: name <code className="text-[12px] text-foreground">Authorization</code>, value <code className="text-[12px] text-foreground">Bearer </code> followed by your CRON_SECRET from Vercel (Settings, Environment Variables). Keep it secret: anyone with it can trigger posting.</li>
          <li>Save, then press Test run. This step turns green within 5 minutes.</li>
        </ol>
      </Step>
    </ol>
  );
}
