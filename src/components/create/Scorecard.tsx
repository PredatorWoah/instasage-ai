'use client';

import Link from 'next/link';
import { useCachedJson } from '@/lib/useCachedJson';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { Scorecard as Card, ScoreRow, Verdict } from '@/services/forecast';
import { Panel, when } from './ui';

const VERDICT: Record<Verdict, { label: string; cls: string; dot: string }> = {
  beat: { label: 'Beat the forecast', cls: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400' },
  hit: { label: 'In range', cls: 'bg-indigo-500/12 text-indigo-400 border-indigo-500/25', dot: 'bg-indigo-400' },
  missed: { label: 'Below the forecast', cls: 'bg-rose-500/12 text-rose-400 border-rose-500/30', dot: 'bg-rose-400' },
  early: { label: 'Too early to judge', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/25', dot: 'bg-amber-400' },
  late: { label: 'Forecast made after posting', cls: 'bg-ink/[0.06] text-muted-foreground border-ink/[0.12]', dot: 'bg-ink/50' },
};
const FORMAT: Record<string, string> = { caption: 'Caption', reel: 'Reel script', carousel: 'Carousel' };

// Expected range as a band, the forecast as a tick, what really happened as a dot
function RangeBar({ row }: { row: ScoreRow }) {
  const p = row.predicted!;
  const min = Math.min(p.low, row.actual) * 0.85;
  const max = Math.max(p.high, row.actual) * 1.08;
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min || 1)) * 100))}%`;
  return (
    <div className="relative h-7" role="img" aria-label={`Expected ${formatNumber(p.low)} to ${formatNumber(p.high)} views, got ${formatNumber(row.actual)}`}>
      <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-ink/[0.07]" />
      <span className="absolute top-1/2 -translate-y-1/2 h-3 rounded-full bg-violet-400/35 border border-violet-400/50" style={{ left: at(p.low), width: `calc(${at(p.high)} - ${at(p.low)})` }} />
      <span className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-violet-400" style={{ left: at(p.views) }} />
      <span className={cn('absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full ring-2 ring-background', VERDICT[row.verdict ?? 'late'].dot)} style={{ left: at(row.actual) }} />
    </div>
  );
}

// How the forecasts made for saved drafts held up once those drafts were posted
export function Scorecard({ account }: { account: string }) {
  const { data } = useCachedJson<Card | null>(`/api/creative/scorecard?account=${encodeURIComponent(account)}`);
  if (data === undefined) return <div className="h-72 rounded-[30px] glass-panel animate-pulse" aria-label="Loading" />;
  if (data === null) return <Panel title="Scorecard"><p role="alert" className="text-[14px] text-muted-foreground">The scorecard did not load. Check your connection and open this tab again.</p></Panel>;

  const tiles = [
    { label: 'Forecasts judged', value: String(data.graded), sub: 'posts at least 3 days old' },
    { label: 'Landed in range', value: data.graded ? `${data.inRange} of ${data.graded}` : '0', sub: data.graded ? `${Math.round((data.inRange / data.graded) * 100)}% of the time` : 'nothing to judge yet' },
    { label: 'Beat it / below it', value: `${data.beat} / ${data.missed}`, sub: 'outside the range' },
    { label: 'Usually off by', value: data.typicalError == null ? 'no data' : `${data.typicalError}%`, sub: 'expected against actual views' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Is Sage any good at this?" sub="Every draft you save gets a forecast before it goes out. Link the draft to the post it became, and three days later the forecast is marked against what really happened.">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl glass-field p-4 min-w-0">
              <p className="text-[12px] font-bold text-muted-foreground">{t.label}</p>
              <p className="font-display font-extrabold text-[26px] sm:text-[30px] tracking-[-0.03em] leading-tight mt-1 break-words">{t.value}</p>
              <p className="text-[12px] text-muted-foreground leading-snug">{t.sub}</p>
            </div>
          ))}
        </div>
        {data.graded > 0 && data.graded < 5 && <p className="text-[12.5px] text-muted-foreground">With only {data.graded} judged so far, treat these numbers as a first impression. They mean more from about 5.</p>}
      </Panel>

      <Panel title="Forecast against reality">
        {data.rows.length === 0 ? (
          <p className="text-[14px] text-muted-foreground rounded-2xl border border-dashed border-ink/20 p-5 leading-relaxed">Nothing to score yet. In Write, save a draft, post it on Instagram, then pick that post under the draft in Saved. It shows up here.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {data.rows.map((r) => {
              const v = r.verdict ? VERDICT[r.verdict] : null;
              return (
                <li key={r.draftId} className="rounded-2xl glass-field p-4 flex flex-col gap-2.5 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-semibold leading-snug break-words line-clamp-2">{r.title}</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">{FORMAT[r.format] ?? 'Caption'} · posted {when(r.postedAt)} · <Link href={`/content/${encodeURIComponent(r.postId)}`} className="underline underline-offset-2 hover:text-foreground">see the post</Link></p>
                    </div>
                    <span className={cn('inline-flex items-center h-8 px-3 rounded-full border text-[12px] font-bold whitespace-nowrap', v?.cls ?? VERDICT.late.cls)}>{v?.label ?? 'No forecast on file'}</span>
                  </div>
                  {r.predicted ? (
                    <>
                      <RangeBar row={r} />
                      <p className="text-[13px] leading-snug break-words">
                        Expected <b>{formatNumber(r.predicted.views)}</b> views (between {formatNumber(r.predicted.low)} and {formatNumber(r.predicted.high)}). Got <b>{formatNumber(r.actual)}</b>
                        {r.error != null && r.verdict !== 'early' && <span className="text-muted-foreground">, {Math.abs(r.error)}% {r.error >= 0 ? 'above' : 'below'} the forecast</span>}.
                        {r.verdict === 'early' && <span className="text-muted-foreground"> Views are still climbing, so this is judged once the post is 3 days old.</span>}
                        {r.verdict === 'late' && <span className="text-muted-foreground"> The draft was saved after the post went out, so it does not count towards the score.</span>}
                      </p>
                    </>
                  ) : (
                    <p className="text-[13px] text-muted-foreground leading-snug">Got {formatNumber(r.actual)} views. This draft was linked before it had a forecast, so there is nothing to compare.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
