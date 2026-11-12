'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, MessageCircle, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import type { Briefing } from '@/services/ai';
import { useFreshAiRead } from '@/components/ai-assistant/useFreshAiRead';
import { withPostLinks } from '@/components/ai-assistant/SageText';
import { askSage } from '@/lib/askSage';
import { cn } from '@/lib/utils';

type Read = { briefing: Briefing; model: string; createdAt: string; stale: boolean };

const written = (iso: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

// The Overview hero: Sage's briefing, rewritten after each sync. While it updates, the last one stays up.
export function SageBriefing({ hasData, fallback, chip, below, actions, side }: {
  hasData: boolean;
  fallback: string; // headline built from the numbers, for when there is no AI key or no briefing yet
  chip: string; // "Your last 30 days · all accounts"
  below?: ReactNode; // "since your last visit"
  actions?: ReactNode; // the sync button
  side?: ReactNode; // the follower and post counters
}) {
  const { result, failure, updating, refresh } = useFreshAiRead<Read>('/api/ai/briefing', hasData);
  const b = result?.briefing;
  const noKey = failure?.code === 'no_key';
  const linkClass = 'font-bold underline underline-offset-2 decoration-white/50 hover:decoration-white';

  return (
    <section className="animate-rise relative overflow-hidden rounded-[34px] prism-hero p-6 sm:p-9 flex flex-col lg:flex-row gap-6 lg:gap-8">
      <div aria-hidden className="absolute right-[18%] -top-36 w-[420px] h-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(255,224,102,0.55),transparent)]" />

      <div className="relative flex-1 min-w-0 flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-chip text-[12px] font-extrabold tracking-[0.06em] uppercase">
            <Sparkles className="w-3.5 h-3.5" /> Sage daily briefing
          </span>
          <span className="px-3 py-1.5 rounded-full glass-chip text-[12px] font-bold">{chip}</span>
          {updating ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-white/85"><RefreshCw className="w-3 h-3 animate-spin" /> Sage is reading your latest numbers…</span>
          ) : result ? (
            <button type="button" onClick={refresh} title="Write a fresh briefing" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/75 hover:text-white">
              Written {written(result.createdAt)} <RefreshCw className="w-3 h-3" />
            </button>
          ) : null}
        </div>

        <h1 className={cn('text-[34px] sm:text-[50px] leading-[1] tracking-[-0.04em] text-balance max-w-[760px] transition-opacity', updating && b && 'opacity-60')}>
          {b ? withPostLinks(b.headline, linkClass) : fallback}
        </h1>

        {b ? (
          <ul className={cn('flex flex-col gap-2.5 max-w-[720px] transition-opacity', updating && 'opacity-60')}>
            {[
              { label: 'Win', text: b.win, dot: 'bg-emerald-300' },
              { label: 'Watch out', text: b.watch, dot: 'bg-rose-300' },
              { label: 'The move', text: `${b.move.format}, ${b.move.when}: ${b.move.idea}`, dot: 'bg-white' },
            ].filter((x) => x.text).map((x) => (
              <li key={x.label} className="flex gap-3 items-start">
                <span aria-hidden className={cn('mt-[7px] w-2 h-2 rounded-full shrink-0', x.dot)} />
                <p className="text-[15px] leading-relaxed text-white/90"><b className="text-white">{x.label}:</b> {withPostLinks(x.text, linkClass)}</p>
              </li>
            ))}
          </ul>
        ) : hasData && !updating ? (
          <p className="text-[14px] text-white/85 max-w-[620px]">
            {noKey ? (
              <>Add an AI key and Sage writes you a short briefing here after every sync. <Link href="/settings#ai" className={linkClass}>Add a key</Link></>
            ) : failure ? (
              <>The briefing could not be written: {failure.error} <button type="button" onClick={refresh} className={linkClass}>Try again</button></>
            ) : null}
          </p>
        ) : updating ? (
          <div className="flex flex-col gap-2.5 max-w-[620px]" aria-label="Writing your briefing">
            {[92, 80, 86].map((w) => <div key={w} className="h-4 rounded-full bg-white/20 animate-pulse" style={{ width: `${w}%` }} />)}
          </div>
        ) : null}

        {below}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-auto">
          {actions}
          <button type="button" onClick={() => askSage(b ? `About today's briefing: "${b.headline}". What's behind it, and what exactly should I do?` : undefined)} className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-white/15 hover:bg-white/25 text-white text-[13px] font-bold transition-colors">
            <MessageCircle className="w-4 h-4" /> Ask Sage about this
          </button>
          <Link href="/insights" transitionTypes={['nav-forward']} className="text-sm font-semibold text-white/90 hover:text-white inline-flex items-center gap-1.5">
            The numbers behind it <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="relative flex flex-col gap-3 lg:w-[340px] shrink-0">
        <TodaysMove move={b?.move ?? null} loading={updating && !b} />
        {side}
      </div>
    </section>
  );
}

function TodaysMove({ move, loading }: { move: Briefing['move'] | null; loading: boolean }) {
  const [saved, setSaved] = useState<string | null>(null);
  const isSaved = !!move && saved === move.idea;

  const save = async () => {
    if (!move) return;
    const res = await fetch('/api/ideas/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: move.idea, notes: `Hook: ${move.hook}\nWhen: ${move.when}${move.basedOn ? `\nBuilds on: ${move.basedOn}` : ''}`, format: move.format.toLowerCase(), source: 'plan' }),
    });
    if (res.ok) setSaved(move.idea);
  };

  if (!move) {
    return (
      <div className="flex-1 rounded-[26px] p-6 bg-white text-[#0A0A0F] flex flex-col gap-3">
        <span className="text-[11px] font-extrabold tracking-[0.1em] prism-text">TODAY&apos;S MOVE</span>
        {loading ? (
          <div className="flex flex-col gap-2">{[70, 90, 60].map((w) => <div key={w} className="h-4 rounded-full bg-black/10 animate-pulse" style={{ width: `${w}%` }} />)}</div>
        ) : (
          <>
            <p className="font-display font-extrabold text-[24px] leading-[1.05] tracking-[-0.03em]">Get a 30-day game plan built from your own numbers.</p>
            <Link href="/recommendations" transitionTypes={['nav-forward']} className="mt-auto self-start inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-[#0A0A0F] text-white text-[13px] font-bold">
              Open the Ideas Studio <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 rounded-[26px] p-6 bg-white text-[#0A0A0F] flex flex-col gap-3">
      <span className="text-[11px] font-extrabold tracking-[0.1em] prism-text">TODAY&apos;S MOVE</span>
      <p className="font-display font-extrabold text-[26px] leading-[1.02] tracking-[-0.03em]">{move.format} · {move.when}</p>
      <p className="text-sm text-[#3F3F4A] leading-relaxed">{move.idea}</p>
      {move.hook && <p className="text-sm text-[#3F3F4A] italic leading-snug">&ldquo;{move.hook}&rdquo;</p>}
      {move.basedOn && (
        <p className="flex items-start gap-1.5 text-[12px] font-bold text-emerald-700">
          <TrendingUp className="w-3.5 h-3.5 mt-px shrink-0" /> Builds on {move.basedOn}
        </p>
      )}
      <div className="mt-auto flex gap-2 pt-1">
        <button type="button" onClick={save} disabled={isSaved} className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-full bg-[#0A0A0F] text-white text-[13px] font-bold disabled:opacity-80">
          {isSaved ? <><Check className="w-4 h-4" /> Saved</> : 'Save to board'}
        </button>
        <button type="button" onClick={() => askSage(`Write me a short script for this ${move.format}: ${move.idea} Open with the hook "${move.hook}". Keep it under 40 seconds.`)} className="flex-1 h-11 rounded-full border-[1.5px] border-black/20 text-[13px] font-bold hover:bg-black/5">
          Write the script
        </button>
      </div>
    </div>
  );
}
