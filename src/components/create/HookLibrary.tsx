'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, PenLine } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { formatLabel } from '@/lib/platform';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { HookLibrary as Library } from '@/services/hooks';
import { Panel, btn, copyText, when } from './ui';

const chipOn = 'inline-flex items-center justify-center h-10 px-4 rounded-full bg-foreground text-background text-[12px] font-bold';
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n}%`;
const tone = (lift: number) => (lift >= 15 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : lift <= -15 ? 'bg-rose-500/10 text-rose-400 border-rose-500/25' : 'bg-ink/[0.06] text-muted-foreground border-ink/[0.1]');

// Every opening line the account has posted, ranked by how the post did, and the hook styles that work
export function HookLibrary({ account, onUse }: { account: string; onUse: (postId: string) => void }) {
  const { data } = useCachedJson<Library | null>(`/api/creative/hooks?account=${encodeURIComponent(account)}`);
  const [style, setStyle] = useState('');
  const [sort, setSort] = useState<'best' | 'new'>('best');
  const [shown, setShown] = useState(20);
  const [note, setNote] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = (data?.hooks ?? []).filter((h) => !style || h.styles.includes(style));
    return sort === 'new' ? [...list].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)) : list;
  }, [data, style, sort]);

  if (data === undefined) return <div className="h-72 rounded-[30px] glass-panel animate-pulse" aria-label="Loading" />;
  if (data === null) return <Panel title="Hook library"><p role="alert" className="text-[14px] text-muted-foreground">Your hooks did not load. Check your connection and open this tab again.</p></Panel>;
  if (!data.posts) return <Panel title="Hook library"><p className="text-[14px] text-muted-foreground rounded-2xl border border-dashed border-ink/20 p-5">No posts with a caption yet. Sync this account and its opening lines show up here.</p></Panel>;

  const widest = Math.max(1, ...data.styles.map((s) => Math.abs(s.lift)));
  return (
    <div className="flex flex-col gap-4">
      <Panel title="What kind of hook works" sub={data.enough ? `From the opening lines of your last ${data.posts} posts. Each bar compares posts that open this way with your usual ${formatNumber(data.medianViews)} views.` : `Only ${data.posts} posts so far. The comparison gets trustworthy from about 8.`}>
        {data.styles.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Not enough posts in any one style to compare yet.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {data.styles.map((s) => (
              <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[220px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="text-[13.5px] font-semibold leading-snug min-w-0">{s.label} <span className="text-muted-foreground font-normal">· {s.posts} posts</span></span>
                <span className="col-span-2 sm:col-span-1 order-3 sm:order-none h-2.5 rounded-full bg-ink/[0.06] overflow-hidden" aria-hidden>
                  <span className={cn('block h-full rounded-full', s.lift >= 0 ? 'bg-emerald-400' : 'bg-rose-400')} style={{ width: `${Math.max(4, (Math.abs(s.lift) / widest) * 100)}%` }} />
                </span>
                <span className={cn('text-[13px] font-bold tabular-nums justify-self-end', s.lift >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{pct(s.lift)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[12.5px] text-muted-foreground leading-snug">These are patterns in your own posts, not rules. Sage reads this list every time it writes hooks for you.</p>
      </Panel>

      <Panel title="Your hooks" sub="Tap Write one like this to open Write with that post as the starting point.">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={!style} onClick={() => { setStyle(''); setShown(20); }} className={!style ? chipOn : btn.small}>All</button>
          {data.styles.map((s) => (
            <button key={s.id} type="button" aria-pressed={style === s.id} onClick={() => { setStyle(s.id); setShown(20); }} className={style === s.id ? chipOn : btn.small}>{s.label}</button>
          ))}
          <select aria-label="Sort hooks" value={sort} onChange={(e) => setSort(e.target.value as 'best' | 'new')} className="glass-field h-10 rounded-full px-4 text-[12px] font-bold sm:ml-auto">
            <option value="best">Most views first</option>
            <option value="new">Newest first</option>
          </select>
        </div>
        {note && <p role="status" className="text-[13px] font-semibold text-indigo-400">{note}</p>}
        <ul className="flex flex-col gap-2">
          {rows.slice(0, shown).map((h) => (
            <li key={h.postId} className="rounded-2xl glass-field p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold leading-snug break-words">{h.line}</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {formatLabel(h.type)} · {when(h.publishedAt)} · {formatNumber(h.views)} views · <Link href={`/content/${encodeURIComponent(h.postId)}`} className="underline underline-offset-2 hover:text-foreground">see the post</Link>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('inline-flex items-center h-8 px-3 rounded-full border text-[12px] font-bold tabular-nums', tone(h.lift))} title="Against your usual views">{pct(h.lift)}</span>
                <button type="button" onClick={async () => setNote((await copyText(h.line)) ? 'Hook copied.' : 'Could not copy. Select the text instead.')} aria-label="Copy this hook" className={`${btn.small} w-10 !px-0 shrink-0`}><Copy className="w-4 h-4" /></button>
                <button type="button" onClick={() => onUse(h.postId)} className={btn.small}><PenLine className="w-3.5 h-3.5 mr-1.5" /> Write one like this</button>
              </div>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p className="text-[14px] text-muted-foreground">No hooks in this style.</p>}
        {rows.length > shown && <button type="button" onClick={() => setShown((n) => n + 20)} className={`${btn.ghost} self-center`}>Show more ({rows.length - shown} left)</button>}
      </Panel>
    </div>
  );
}
