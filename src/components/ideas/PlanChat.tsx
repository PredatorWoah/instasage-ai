'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarPlus, Loader2, MessagesSquare, Send, Undo2 } from 'lucide-react';
import { primeJson, refreshJson, useCachedJson } from '@/lib/useCachedJson';
import { AiNotice } from '@/components/ai-assistant/AiNotice';
import { cn } from '@/lib/utils';
import type { GamePlan, PlanTurn } from '@/services/ai';

const CHAT_URL = '/api/ai/plan/chat';
const SUGGESTIONS = [
  'I can only post 3 times a week. Rework the schedule.',
  'More Hinglish reels, fewer photos.',
  'Make week 1 about acne marks and PIH.',
  'Put week 1 on my calendar.',
  'Replace the experiments with ones I can run this week.',
];

type Chat = { turns: PlanTurn[]; canUndo: boolean };
type Answer = Chat & { plan: GamePlan; model: string; createdAt: string; changed?: boolean; added?: number };

// Tell Sage what to change; it rewrites the saved plan, and can put posts on the calendar
export function PlanChat({ planUrl }: { planUrl: string }) {
  const { data } = useCachedJson<Chat | null>(CHAT_URL);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ error: string; code?: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const turns = data?.turns ?? [];

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, pending]);

  const apply = (body: Answer) => {
    primeJson(CHAT_URL, { turns: body.turns, canUndo: body.canUndo });
    primeJson(planUrl, { plan: body.plan, model: body.model, createdAt: body.createdAt });
    if (body.added) refreshJson('/api/ideas/saved');
  };

  const send = async (message: string, undo = false) => {
    if (busy || (!undo && !message.trim())) return;
    setBusy(true);
    setFailure(null);
    if (!undo) {
      setPending(message.trim());
      setText('');
    }
    try {
      const res = await fetch(CHAT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(undo ? { undo: true } : { message: message.trim() }) });
      const body = await res.json().catch(() => ({ error: 'Sage took too long or sent back something unexpected. Try again.' }));
      if (res.ok) {
        apply(body as Answer);
        if (undo) toast.success('Plan restored');
      } else {
        setFailure(body);
        if (!undo) setText(message);
      }
    } catch {
      setFailure({ error: 'Could not reach the server. Check your connection and try again.' });
      if (!undo) setText(message);
    }
    setPending(null);
    setBusy(false);
  };

  return (
    <section className="rounded-[30px] p-5 sm:p-6 bg-card border border-ink/[0.05] flex flex-col gap-4 min-w-0" aria-label="Change the plan with Sage">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold flex items-center gap-2"><MessagesSquare className="w-4 h-4 text-indigo-400" /> Change the plan with Sage</h3>
          <p className="text-[13px] text-muted-foreground leading-snug mt-0.5">Say what to change in plain words. Sage rewrites the plan itself, and can put posts on your calendar. Everything here is saved.</p>
        </div>
        {data?.canUndo && (
          <button type="button" onClick={() => send('', true)} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-[12px] font-bold hover:bg-ink/[0.12] disabled:opacity-50 shrink-0">
            <Undo2 className="w-3.5 h-3.5" /> Undo last change
          </button>
        )}
      </div>

      {(turns.length > 0 || pending) && (
        <div ref={listRef} className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto -mx-1 px-1">
          {turns.map((t, i) => (
            <div key={i} className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug break-words', t.role === 'user' ? 'self-end bg-ink text-background' : 'self-start bg-ink/[0.05] border border-ink/[0.08]')}>
              <p className="whitespace-pre-wrap">{t.content}</p>
              {t.changes && t.changes.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {t.changes.map((c) => <li key={c} className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/12 text-emerald-400 border border-emerald-500/25">{c}</li>)}
                </ul>
              )}
              {!!t.added && (
                <Link href="/create?tab=calendar" className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-indigo-400 hover:underline">
                  <CalendarPlus className="w-3.5 h-3.5" /> {t.added} {t.added === 1 ? 'post' : 'posts'} added to your calendar
                </Link>
              )}
            </div>
          ))}
          {pending && (
            <>
              <div className="self-end max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug bg-ink text-background whitespace-pre-wrap break-words">{pending}</div>
              <div className="self-start rounded-2xl px-3.5 py-2.5 text-[13px] bg-ink/[0.05] border border-ink/[0.08] inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Sage is reworking the plan. This takes 20 to 60 seconds.
              </div>
            </>
          )}
        </div>
      )}

      {turns.length === 0 && !pending && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => send(s)} disabled={busy} className="text-left text-[12.5px] font-semibold px-3.5 py-2 rounded-full bg-ink/[0.05] border border-ink/[0.08] hover:bg-ink/[0.1] disabled:opacity-50">{s}</button>
          ))}
        </div>
      )}

      {failure && <AiNotice code={failure.code} message={failure.error} />}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="flex items-end gap-2"
      >
        <label htmlFor="plan-chat" className="sr-only">What should change in the plan?</label>
        <textarea
          id="plan-chat"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder="e.g. Swap Tuesday's carousel for a reel"
          className="flex-1 min-w-0 rounded-2xl border border-border bg-background/60 px-3.5 py-2.5 text-sm leading-snug resize-none focus:outline-none focus:border-indigo-500"
        />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="h-11 w-11 sm:w-auto sm:px-5 inline-flex items-center justify-center gap-1.5 rounded-full bg-ink text-background text-[13px] font-bold disabled:opacity-50 shrink-0">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}<span className="hidden sm:inline">{busy ? 'Working' : 'Send'}</span>
        </button>
      </form>
    </section>
  );
}
