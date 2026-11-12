'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, RefreshCw } from 'lucide-react';
import type { Briefing } from '@/services/ai';
import { useFreshAiRead } from '@/components/ai-assistant/useFreshAiRead';
import { askSage } from '@/lib/askSage';

type Read = { briefing: Briefing; model: string; createdAt: string; stale: boolean };

// "Post next": Sage's next move, rewritten after each sync. Falls back to the Ideas Studio without an AI key.
export function NextMoveCard({ hasData }: { hasData: boolean }) {
  const { result, failure, updating, refresh } = useFreshAiRead<Read>('/api/ai/briefing', hasData);
  const [saved, setSaved] = useState<string | null>(null);
  const move = result?.briefing.move;

  const save = async () => {
    if (!move) return;
    const res = await fetch('/api/ideas/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: move.idea, notes: `Hook: ${move.hook}\nWhen: ${move.when}${move.basedOn ? `\nBuilds on: ${move.basedOn}` : ''}`, format: move.format.toLowerCase(), source: 'plan' }),
    });
    if (res.ok) setSaved(move.idea);
  };

  return (
    <article className="glass-tint rounded-[30px] p-6 sm:p-7 flex flex-col gap-2.5 min-h-[250px] bg-blue-500/20 border border-blue-300/35 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold text-foreground/85">Post next</span>
        {updating ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-label="Sage is updating this" /> : move ? (
          <button type="button" onClick={refresh} aria-label="Ask Sage for a fresh next move" className="w-9 h-9 -m-2 flex items-center justify-center text-muted-foreground hover:text-foreground"><RefreshCw className="w-3.5 h-3.5" /></button>
        ) : null}
      </div>
      {move ? (
        <>
          <p className="font-display font-extrabold text-[34px] sm:text-[40px] leading-[0.95] tracking-[-0.04em] text-balance break-words">{move.format}, {move.when.replace(/^./, (c) => c.toLowerCase())}.</p>
          <p className="text-[15px] font-semibold leading-snug break-words">{move.idea}</p>
          {move.hook && <p className="text-[14px] italic text-foreground/80 leading-snug break-words">&ldquo;{move.hook}&rdquo;</p>}
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <button type="button" onClick={save} disabled={saved === move.idea} className="h-11 px-5 rounded-full bg-foreground text-background text-[13px] font-bold inline-flex items-center gap-1.5 disabled:opacity-80">{saved === move.idea ? <><Check className="w-4 h-4" /> Saved</> : 'Save it'}</button>
            <Link href={`/create?topic=${encodeURIComponent(move.idea.slice(0, 200))}`} className="h-11 px-5 rounded-full glass-field text-[13px] font-bold inline-flex items-center">Write the caption</Link>
            <button type="button" onClick={() => askSage(`Write me a short script for this ${move.format}: ${move.idea} Open with the hook "${move.hook}". Keep it under 40 seconds.`)} className="h-11 px-5 rounded-full glass-field text-[13px] font-bold">Script</button>
          </div>
        </>
      ) : updating ? (
        <div className="flex flex-col gap-2.5 mt-2" aria-label="Sage is working out your next post">{[60, 90, 75].map((w) => <div key={w} className="h-5 rounded-full bg-ink/[0.1] animate-pulse" style={{ width: `${w}%` }} />)}</div>
      ) : (
        <>
          <p className="font-display font-extrabold text-[30px] sm:text-[34px] leading-[0.98] tracking-[-0.04em]">{failure?.code === 'no_key' ? 'Add an AI key and Sage plans it.' : 'Get your next post from the Ideas Studio.'}</p>
          <Link href={failure?.code === 'no_key' ? '/settings#ai' : '/recommendations'} className="mt-auto self-start h-11 px-5 rounded-full bg-foreground text-background text-[13px] font-bold inline-flex items-center">{failure?.code === 'no_key' ? 'Add a key' : 'Open Ideas'}</Link>
        </>
      )}
    </article>
  );
}
