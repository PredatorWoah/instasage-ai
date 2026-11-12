'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, RotateCw } from 'lucide-react';
import { PostThumb } from '@/components/dashboard/PostThumb';
import { askSage } from '@/lib/askSage';
import { formatLabel } from '@/lib/platform';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/lib/utils';

export type FlipPost = {
  id: string;
  type: string;
  platform: string;
  caption: string;
  thumbnail: string;
  views: number;
  reach?: number | null;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  performanceScore: number;
  publishedAt: string;
  isBoosted?: boolean;
  aiVerdict?: string | null;
};

type Detail = { snapshots: { hours: number; views: number }[]; post: { avgWatchMs?: number | null } };
const DAY = 86_400_000;

// Views over the post's first days as an SVG line, from the snapshots each sync stores
function spark(snaps: { hours: number; views: number }[]) {
  const pts = [{ hours: 0, views: 0 }, ...snaps.filter((s) => s.hours <= 96)];
  if (pts.length < 3) return null;
  const maxH = Math.max(...pts.map((p) => p.hours), 1);
  const maxV = Math.max(...pts.map((p) => p.views), 1);
  return pts.map((p) => `${((p.hours / maxH) * 200).toFixed(1)},${(50 - (p.views / maxV) * 44).toFixed(1)}`).join(' ');
}

// A post you can turn over: the front is the post, the back is everything about how it did
export function FlipCard({ post, avgViews, avgEngagement, now }: { post: FlipPost; avgViews: number; avgEngagement: number; now: number }) {
  const [flipped, setFlipped] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const yt = post.platform === 'youtube';
  const young = now - new Date(post.publishedAt).getTime() < 2 * DAY;
  const lift = avgViews > 0 ? Math.round(((post.views - avgViews) / avgViews) * 100) : null;
  const chip = post.isBoosted
    ? { text: 'Boosted', tone: 'bg-amber-400 text-black' }
    : young
      ? { text: 'Still collecting', tone: 'bg-white/25 text-white' }
      : lift == null
        ? null
        : { text: `${lift >= 0 ? '+' : ''}${lift}% vs avg`, tone: lift >= 0 ? 'bg-lime-300 text-black' : 'bg-rose-400 text-black' };
  const good = !young && lift != null && lift >= 0;
  const line = young || lift == null ? '#FFD23F' : good ? '#C3F53C' : '#FF8A8A';
  const title = post.caption.replace(/\s+/g, ' ').trim() || (yt ? 'Untitled video' : 'No caption');
  const engBar = Math.min(100, avgEngagement > 0 ? (post.performanceScore / (avgEngagement * 1.6)) * 100 : 0);

  const flip = () => {
    const next = !flipped;
    setFlipped(next);
    // The growth line and watch time load the first time the card is turned
    if (next && !detail) {
      setFailed(false);
      fetch(`/api/posts/${encodeURIComponent(post.id)}`).then((r) => (r.ok ? r.json() : null)).then((d) => (d?.snapshots ? setDetail(d) : setFailed(true))).catch(() => setFailed(true));
    }
  };

  const points = detail ? spark(detail.snapshots) : null;
  const watch = detail?.post.avgWatchMs;
  const stats = [
    ...(yt ? [] : [{ label: 'Reach', value: post.reach != null ? formatNumber(post.reach) : '—' }]),
    { label: 'Likes', value: formatNumber(post.likes) },
    { label: 'Replies', value: formatNumber(post.comments) },
    ...(yt ? [] : [{ label: 'Saves', value: formatNumber(post.saves) }, { label: 'Shares', value: formatNumber(post.shares) }]),
    ...(watch != null ? [{ label: 'Watch', value: `${(watch / 1000).toFixed(1)}s` }] : []),
  ].slice(0, 6);

  return (
    <div className="flip-scene">
      <div className="flip-card h-[500px]" data-flipped={flipped}>
        {/* Front */}
        <div inert={flipped} className="flip-face flip-front on-color rounded-[28px] overflow-hidden border border-white/20 bg-[linear-gradient(160deg,#8C7BFF,#FF6F91)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)] text-white">
          <PostThumb src={post.thumbnail} type={post.type} sizes="(max-width: 640px) 100vw, 320px" zoom={false} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/80" />
          <div className="absolute left-3.5 right-3.5 top-3.5 flex flex-wrap gap-1.5">
            <span className="px-3 py-1.5 rounded-full bg-black/60 text-[12px] font-bold whitespace-nowrap">{formatLabel(post.type)} · {new Date(post.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
            {chip && <span className={cn('px-3 py-1.5 rounded-full text-[12px] font-extrabold whitespace-nowrap', chip.tone)}>{chip.text}</span>}
          </div>
          <div className="absolute left-4 right-4 bottom-[78px] flex flex-col gap-1.5">
            <p className="font-display font-extrabold text-[52px] leading-[0.88] tracking-[-0.05em]">{formatNumber(post.views)}</p>
            <p className="text-[13.5px] font-bold leading-snug line-clamp-2 break-words">{title}</p>
          </div>
          <button type="button" onClick={flip} aria-label={`Flip to see the numbers behind: ${title.slice(0, 60)}`} className="absolute left-3.5 right-3.5 bottom-3.5 h-[50px] rounded-full border border-white/35 bg-black/45 text-[13px] font-bold inline-flex items-center justify-center gap-1.5 hover:bg-black/60 transition-colors">
            Flip it <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Back */}
        <div inert={!flipped} className="flip-face flip-back flip-back-solid rounded-[28px] p-4 flex flex-col gap-2.5 overflow-hidden">
          <p className="text-[13px] font-bold leading-[1.4] line-clamp-2 break-words shrink-0">{title}</p>

          <div className="rounded-2xl bg-ink/[0.06] border border-ink/[0.1] px-3 py-2">
            <p className="text-[11px] font-bold text-muted-foreground mb-1">Views over its first days</p>
            {points ? (
              <svg viewBox="0 0 200 54" className="w-full h-[46px]" role="img" aria-label="Views climbing over the post's first days">
                <polyline fill="none" stroke={line} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />
              </svg>
            ) : (
              <p className="h-[46px] flex items-center text-[11.5px] text-muted-foreground">{detail ? 'Fills in after a few daily syncs.' : failed ? 'Could not load this. Flip again to retry.' : 'Loading…'}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-ink/[0.07] px-2.5 py-2 min-w-0">
                <p className="text-[10.5px] font-semibold text-muted-foreground truncate">{s.label}</p>
                <p className="font-display font-extrabold text-[18px] tracking-[-0.03em] truncate">{s.value}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="flex justify-between gap-2 text-[11px] font-bold text-muted-foreground mb-1.5 whitespace-nowrap">
              <span>Engagement {post.performanceScore.toFixed(1)}%</span>
              <span>avg {avgEngagement.toFixed(1)}%</span>
            </div>
            <div aria-hidden className="relative h-2 rounded-full bg-ink/[0.12]">
              <div className="h-full rounded-full" style={{ width: `${engBar}%`, background: post.performanceScore >= avgEngagement ? '#C3F53C' : '#FF8A8A' }} />
              <div className="absolute -top-[3px] -bottom-[3px] w-0.5 bg-foreground" style={{ left: '62.5%' }} />
            </div>
          </div>

          {post.aiVerdict && (
            <div className="rounded-2xl bg-violet-500/10 border border-violet-400/25 px-3 py-2.5 shrink-0">
              <p className="text-[10px] font-extrabold tracking-[0.08em] text-muted-foreground">SAGE</p>
              <p className="text-[12.5px] leading-[1.45] font-semibold line-clamp-3 break-words">{post.aiVerdict}</p>
            </div>
          )}

          <div className="mt-auto grid grid-cols-3 gap-1.5">
            <button type="button" onClick={() => askSage(`About my ${post.type} "${title.slice(0, 80)}" (${post.views} views): why did it do ${good ? 'well' : 'the way it did'}, and what should I repeat or change?`)} aria-label="Ask Sage about this post" className="h-11 rounded-full bg-foreground text-background text-[12px] font-bold inline-flex items-center justify-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> Ask</button>
            <Link href={`/content/${encodeURIComponent(post.id)}`} className="h-11 rounded-full glass-field text-[12px] font-bold inline-flex items-center justify-center">Open</Link>
            <button type="button" onClick={flip} aria-label="Flip back" className="h-11 rounded-full glass-field text-[12px] font-bold inline-flex items-center justify-center gap-1">Back <RotateCw className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
