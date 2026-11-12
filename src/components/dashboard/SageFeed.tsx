import Link from 'next/link';
import { CircleUser, RefreshCw, Sparkles, Target, Undo2, Zap } from 'lucide-react';
import type { FeedItem } from '@/services/feed';
import { withPostLinks } from '@/components/ai-assistant/SageText';
import { cn } from '@/lib/utils';

const LOOK: Record<FeedItem['kind'], { icon: typeof Sparkles; tile: string }> = {
  review: { icon: Sparkles, tile: 'bg-violet-500/12 text-violet-400' },
  action: { icon: Undo2, tile: 'bg-sky-500/12 text-sky-400' },
  post: { icon: Zap, tile: 'bg-amber-500/12 text-amber-400' },
  rival: { icon: CircleUser, tile: 'bg-rose-500/12 text-rose-400' },
  goal: { icon: Target, tile: 'bg-emerald-500/12 text-emerald-400' },
  sync: { icon: RefreshCw, tile: 'bg-ink/[0.06] text-muted-foreground' },
};

// "Live from Sage": reviews, corrections, fresh posts, rivals and syncs, newest first
export function SageFeed({ items }: { items: FeedItem[] }) {
  return (
    <section className="rounded-[30px] p-5 sm:p-6 bg-card border border-ink/[0.05] flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-xl font-bold">Live from Sage</h2>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> updates itself
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">Nothing yet. Sync your accounts and Sage starts reviewing your posts and watching your numbers here.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item, i) => {
            const look = LOOK[item.kind];
            const body = <p className="text-[13.5px] leading-relaxed text-foreground/85">{withPostLinks(item.text)}</p>;
            return (
              <li key={item.id} className={cn('flex gap-3.5 py-3', i > 0 && 'border-t border-ink/[0.06]')}>
                <span aria-hidden className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', look.tile)}>
                  <look.icon className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  {item.href ? <Link href={item.href} className="block hover:opacity-80">{body}</Link> : body}
                </div>
                <span className="text-[11.5px] text-muted-foreground tabular-nums shrink-0 pt-0.5">{item.ago}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
