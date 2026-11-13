'use client';

import Link from 'next/link';
import { MessageCircle, RefreshCw, Sparkles } from 'lucide-react';
import type { NotePage, PageNote } from '@/services/ai';
import { useFreshAiRead } from './useFreshAiRead';
import { withPostLinks } from './SageText';
import { askSage } from '@/lib/askSage';
import { usePeriod } from '@/lib/usePeriod';
import { cn } from '@/lib/utils';
import { AiPicker } from '@/components/ai-assistant/AiPicker';

type Read = { note: PageNote; model: string; createdAt: string; stale: boolean };

const ASK: Record<NotePage, string> = {
  analytics: 'Walk me through my analytics for this window: what changed, why, and what should I do?',
  content: 'Looking at my content library: which posts should I repurpose or follow up, and which ones should I learn from?',
  audience: 'Tell me more about my audience and when to post for them.',
};

// Sage's short read of the page you are on. Refreshes itself after each sync or correction.
export function SageNote({ page, enabled = true }: { page: NotePage; enabled?: boolean }) {
  const { result, failure, updating, loading, refresh } = useFreshAiRead<Read>(`/api/ai/note?page=${page}`, enabled);
  const { label } = usePeriod();
  const note = result?.note;
  if (!enabled) return null;

  return (
    <section className="relative overflow-hidden rounded-[30px] bg-card border border-violet-500/25 p-5 sm:p-6 flex flex-col gap-3">
      <div aria-hidden className="absolute -right-24 -top-28 w-[300px] h-[300px] rounded-full bg-[radial-gradient(closest-side,rgba(140,123,255,0.22),transparent)]" />
      <div className="relative flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/12 border border-violet-500/30 text-violet-400 text-[11px] font-extrabold tracking-[0.08em] uppercase">
          <Sparkles className="w-3 h-3" /> Sage&apos;s read
        </span>
        <span className="text-[12px] text-muted-foreground font-semibold">{label}</span>
        <span className="ml-auto flex items-center gap-2">
          <AiPicker group="insights" compact />
          {updating ? (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground"><RefreshCw className="w-3 h-3 animate-spin" /> Updating…</span>
          ) : result ? (
            <button type="button" onClick={refresh} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground" title="Ask Sage for a fresh read">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          ) : null}
        </span>
      </div>

      {note ? (
        <div className={cn('relative flex flex-col gap-2.5 transition-opacity', updating && 'opacity-60')}>
          <p className="font-display font-extrabold text-[20px] sm:text-[24px] leading-[1.15] tracking-[-0.02em] text-balance">{withPostLinks(note.headline)}</p>
          <ul className="flex flex-col gap-1.5">
            {note.points.map((p, i) => (
              <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-foreground/80">
                <span aria-hidden className="mt-[8px] w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                <span>{withPostLinks(p)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : loading || updating ? (
        <div className="relative flex flex-col gap-2" aria-label="Sage is reading this page">
          {[75, 92, 84].map((w) => <div key={w} className="h-3.5 rounded-full bg-ink/[0.08] animate-pulse" style={{ width: `${w}%` }} />)}
        </div>
      ) : failure ? (
        <p className="relative text-[13px] text-muted-foreground">
          {failure.code === 'no_key' ? <>Add an AI key and Sage explains this page for you. <Link href="/settings#ai" className="font-bold text-violet-400 hover:underline">Add a key</Link></> : failure.code === 'no_data' ? 'Sync an account first, then Sage reads this page for you.' : <>Sage could not read this page: {failure.error} <button type="button" onClick={refresh} className="font-bold text-violet-400 hover:underline">Try again</button></>}
        </p>
      ) : null}

      <div className="relative">
        <button type="button" onClick={() => askSage(ASK[page])} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-ink/[0.07] hover:bg-ink/[0.12] text-[12.5px] font-bold transition-colors">
          <MessageCircle className="w-3.5 h-3.5" /> Ask Sage about this
        </button>
      </div>
    </section>
  );
}
