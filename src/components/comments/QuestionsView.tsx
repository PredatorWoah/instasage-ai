'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Lightbulb, MessageCircleQuestion, PenLine, RefreshCw, Sparkles } from 'lucide-react';
import { AiNotice } from '@/components/ai-assistant/AiNotice';
import { AiPicker } from '@/components/ai-assistant/AiPicker';
import { saveIdea } from '@/components/ideas/saveIdea';
import { formatLabel } from '@/lib/platform';
import { formatRelativeTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { Mined } from '@/services/questions';

type Load = (Partial<Mined> & { error?: string; code?: string; stale?: string }) | null;

const card = 'rounded-[30px] bg-card border border-ink/[0.05] p-5 sm:p-6';
const pill = 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-[12.5px] font-bold hover:bg-ink/[0.12] disabled:opacity-50 transition-colors';

// The questions people ask under your posts, grouped by topic, and the post ideas they add up to
export function QuestionsView({ permissionCard }: { permissionCard: React.ReactNode }) {
  const [load, setLoad] = useState<Load>(null);
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [aiError, setAiError] = useState<{ error: string; code?: string } | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [openOnly, setOpenOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/comments/questions${nonce ? '?refresh=1' : ''}`)
      .then((r) => r.json().catch(() => ({ error: 'Unexpected response from the server.' })))
      .then((body) => !cancelled && setLoad(body))
      .catch(() => !cancelled && setLoad({ error: 'Could not reach the server. Check your connection.' }))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reread = () => {
    setBusy(true);
    setNonce((n) => n + 1);
  };

  const makeIdeas = async () => {
    setThinking(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/questions', { method: 'POST' });
      const body = await res.json().catch(() => ({ error: 'Unexpected response from the server.' }));
      if (res.ok) setLoad(body);
      else setAiError(body);
    } catch {
      setAiError({ error: 'Could not reach the server. Try again.' });
    }
    setThinking(false);
  };

  const keep = async (title: string, format: string, why: string) => {
    if (await saveIdea({ title, format, notes: why ? `From comment questions. ${why}` : 'From comment questions.', source: 'recommendation' })) setSaved((s) => new Set(s).add(title));
  };

  if (!load) return <div className="h-80 rounded-[30px] bg-card animate-pulse" aria-label="Reading your comments" />;
  if (load.code === 'needs_comment_permission') return <>{permissionCard}</>;
  if (load.error || !load.themes) {
    return (
      <div role="alert" className={cn(card, 'flex flex-col gap-3 items-start')}>
        <p className="font-bold text-lg">The questions did not load.</p>
        <p className="text-sm text-muted-foreground break-words">{load.error ?? 'The server sent back something unexpected.'}</p>
        {load.code !== 'no_instagram' && <button type="button" onClick={reread} disabled={busy} className={pill}><RefreshCw className={cn('w-3.5 h-3.5', busy && 'animate-spin')} /> Try again</button>}
      </div>
    );
  }

  const themes = load.themes.map((t) => ({ ...t, questions: openOnly ? t.questions.filter((q) => !q.answered) : t.questions })).filter((t) => t.questions.length);
  const total = load.questions ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <section className={cn(card, 'flex flex-col gap-4')}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold">{total ? `${total} ${total === 1 ? 'question' : 'questions'} from your comments` : 'No questions in your recent comments'}</h2>
            <p className="text-[13px] text-muted-foreground mt-1 leading-snug">
              {(load.postsRead ?? 0) > 0
                ? `Read ${load.comments ?? 0} ${load.comments === 1 ? 'comment' : 'comments'} under your ${load.postsRead} most commented ${load.postsRead === 1 ? 'post' : 'posts'} of the last 90 days${load.at ? `, ${formatRelativeTime(load.at).toLowerCase()}` : ''}.`
                : 'None of your Instagram posts from the last 90 days has a comment yet, so there was nothing to read.'}
              {(load.unanswered ?? 0) > 0 && <> <b className="text-amber-400">{load.unanswered} still unanswered.</b></>}
              {(load.postsFailed ?? 0) > 0 && <> Instagram did not answer for {load.postsFailed} {load.postsFailed === 1 ? 'post' : 'posts'}.</>}
            </p>
          </div>
          <button type="button" onClick={reread} disabled={busy} className={cn(pill, 'shrink-0 self-start')}><RefreshCw className={cn('w-3.5 h-3.5', busy && 'animate-spin')} /> {busy ? 'Reading…' : 'Read again'}</button>
        </div>
        {load.stale && <p className="text-[12.5px] text-amber-400 bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2 break-words">Showing the last read. The new one failed: {load.stale}</p>}

        {total > 0 && (
          <div className="rounded-2xl bg-violet-500/[0.08] border border-violet-400/20 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold inline-flex items-center gap-1.5 mr-auto"><Lightbulb className="w-4 h-4 text-indigo-400" /> Post ideas from these questions</span>
              <AiPicker group="insights" compact />
              <button type="button" onClick={makeIdeas} disabled={thinking} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-ink text-background text-[12.5px] font-bold disabled:opacity-60">
                <Sparkles className="w-3.5 h-3.5" /> {thinking ? 'Sage is reading…' : load.ideas?.length ? 'Ask Sage again' : 'Ask Sage for ideas'}
              </button>
            </div>
            {aiError && <AiNotice code={aiError.code} message={aiError.error} />}
            {load.ideas?.length ? (
              <ul className="grid md:grid-cols-2 gap-2.5">
                {load.ideas.map((i) => (
                  <li key={i.title} className="rounded-2xl bg-ink/[0.04] border border-ink/[0.08] p-3.5 flex flex-col gap-2 min-w-0">
                    <p className="text-[14px] font-semibold leading-snug break-words">{i.title}</p>
                    <p className="text-[12.5px] text-muted-foreground leading-snug break-words">{formatLabel(i.format)} · answers {i.asked} {i.asked === 1 ? 'question' : 'questions'}{i.why ? `. ${i.why}` : ''}</p>
                    <div className="flex flex-wrap gap-2 mt-auto">
                      <Link href={`/create?topic=${encodeURIComponent(i.title)}`} className={pill}><PenLine className="w-3.5 h-3.5" /> Write it</Link>
                      <button type="button" onClick={() => keep(i.title, i.format, i.why)} disabled={saved.has(i.title)} className={pill}>{saved.has(i.title) ? <><Check className="w-3.5 h-3.5" /> Saved</> : 'Save to idea board'}</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : !aiError && (
              <p className="text-[12.5px] text-muted-foreground leading-snug">Sage reads the questions below and suggests posts that answer the ones people keep asking. Or tap Write a post on any question yourself.</p>
            )}
          </div>
        )}
      </section>

      {total > 0 && (
        <label className="inline-flex items-center gap-2.5 text-[13px] font-semibold min-h-11 cursor-pointer self-start px-1">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="w-5 h-5 accent-[#8E78FF]" />
          Only show unanswered
        </label>
      )}

      {total === 0 ? (
        <p className="text-sm text-muted-foreground p-4 rounded-xl border border-dashed border-border">Nothing that reads like a question yet. They show up here as people ask them, in English or Hinglish.</p>
      ) : themes.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4 rounded-xl border border-dashed border-border">Every question has an answer from you. Nice.</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          {themes.map((t) => (
            <section key={t.key || 'other'} className={cn(card, 'flex flex-col gap-3 min-w-0')}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-[17px] inline-flex items-center gap-2 min-w-0"><MessageCircleQuestion className="w-4.5 h-4.5 text-indigo-400 shrink-0" /><span className="truncate">{t.label}</span></h3>
                <span className="text-[12px] font-bold text-muted-foreground shrink-0">{t.questions.length} {t.questions.length === 1 ? 'question' : 'questions'}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {t.questions.slice(0, 6).map((q) => (
                  <li key={q.id} className="rounded-2xl bg-ink/[0.03] border border-ink/[0.06] p-3 flex flex-col gap-1.5 min-w-0">
                    <p className="text-[14px] leading-snug break-words">{q.text}</p>
                    <p className="text-[11.5px] text-muted-foreground break-words">
                      @{q.username} · {formatRelativeTime(q.at)} · {q.answered ? <span className="text-emerald-400 font-semibold">answered</span> : <span className="text-amber-400 font-semibold">not answered</span>}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-bold">
                      <Link href={`/comments?post=${encodeURIComponent(q.postId)}`} className="text-indigo-400 hover:underline">{q.answered ? 'Open the thread' : 'Reply'}</Link>
                      <Link href={`/create?topic=${encodeURIComponent(q.text.slice(0, 200))}`} className="text-indigo-400 hover:underline">Write a post about it</Link>
                    </div>
                  </li>
                ))}
              </ul>
              {t.questions.length > 6 && <p className="text-[12px] text-muted-foreground">and {t.questions.length - 6} more like these.</p>}
              {t.key && (
                <button type="button" disabled={saved.has(`topic:${t.key}`)} onClick={async () => { await keep(`Answer the "${t.label.toLowerCase()}" questions people keep asking`, 'reel', `${t.questions.length} comments asked about ${t.label.toLowerCase()}.`); setSaved((x) => new Set(x).add(`topic:${t.key}`)); }} className={cn(pill, 'self-start')}>
                  <Lightbulb className="w-3.5 h-3.5" /> Save this topic as an idea
                </button>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
