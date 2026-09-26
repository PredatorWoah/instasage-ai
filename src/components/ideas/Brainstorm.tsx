'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowUp, BookmarkPlus, Check, Copy, MessageSquarePlus, Trash2 } from 'lucide-react';
import { primeJson, useCachedJson } from '@/lib/useCachedJson';
import { SageOrb } from '@/components/ai-assistant/SageOrb';
import { AiNotice } from '@/components/ai-assistant/AiNotice';
import { Markdown } from './Markdown';
import { saveIdea } from './saveIdea';
import { cn } from '@/lib/utils';
import { usePlatform } from '@/lib/usePlatform';
import { formatRelativeTime } from '@/utils/formatters';

type Thread = { id: string; title: string; updatedAt: string; messages: number };
type Message = { id: string; role: 'user' | 'assistant'; content: string; model?: string | null; pending?: boolean };

const THREADS_URL = '/api/ideas/threads';

const STARTERS = [
  { title: 'Plan my week', prompt: 'What should I post this week? Give me 5 ideas with the hook, format and best time for each, based on what already works for me.' },
  { title: 'Roast my captions', prompt: 'Roast my last 5 captions honestly, then rewrite the weakest one three different ways.' },
  { title: 'Turn a hit into a series', prompt: 'Take my best performing post and turn it into a 3 part series. Give each part a hook and a caption opener.' },
  { title: '10 scroll stopping hooks', prompt: 'Give me 10 scroll stopping hooks for reels in my niche, the kind my audience actually responds to.' },
  { title: 'Why did these flop?', prompt: 'Look at my weakest posts. Why did they flop, and what would you change to save each idea?' },
  { title: 'One bold experiment', prompt: 'What is one bold experiment I should try this month that could break my usual numbers? Make the case with my data.' },
];

const STARTERS_YT = [
  { title: 'Next 3 videos', prompt: 'What should my next 3 videos be? Give each a title, a thumbnail concept and the first 10 seconds, based on what already works on my channel.' },
  { title: 'Fix my titles', prompt: 'Rate my last 5 video titles honestly, then rewrite the weakest one five different ways.' },
  { title: 'Shorts vs long form', prompt: 'Should I make more Shorts or more long videos? Make the case from my numbers and suggest a weekly mix.' },
  { title: 'Turn a hit into a series', prompt: 'Take my best performing video and turn it into a series. Give each episode a title and thumbnail idea.' },
  { title: 'Why did these flop?', prompt: 'Look at my weakest videos. Why did they underperform, and what title or format change would have saved each one?' },
  { title: 'Shorts that feed long form', prompt: 'Give me 5 Shorts ideas that pull viewers into my long videos, with the hook line for each.' },
];

// Title for a board card: the first heading or line of the reply
const ideaTitle = (text: string) =>
  (text.split('\n').map((l) => l.replace(/^[#>*\-\d.)\s]+/, '').replace(/\*\*/g, '').trim()).find((l) => l.length > 3) ?? 'Brainstorm idea').slice(0, 120);

export function Brainstorm() {
  const { data: threadsData, refresh } = useCachedJson<Thread[]>(THREADS_URL);
  const threads = threadsData ?? [];
  const { t } = usePlatform();
  const starters = t.yt ? STARTERS_YT : STARTERS;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<{ error: string; code?: string } | null>(null);
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const open = async (id: string | null) => {
    setActiveId(id);
    setFailure(null);
    if (!id) {
      setMessages([]);
      inputRef.current?.focus();
      return;
    }
    setLoadingThread(true);
    const res = await fetch(`${THREADS_URL}/${id}`);
    const data = res.ok ? await res.json() : null;
    setMessages(data?.messages ?? []);
    setLoadingThread(false);
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setFailure(null);
    setInput('');
    const temp: Message[] = [
      { id: 'pending-user', role: 'user', content },
      { id: 'pending-ai', role: 'assistant', content: '', pending: true },
    ];
    setMessages((m) => [...m, ...temp]);

    const res = await fetch(`${THREADS_URL}/${activeId ?? 'new'}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json().catch(() => ({ error: 'The AI took too long to answer. Try again.' }));
    if (res.ok) {
      setMessages((m) => [...m.filter((x) => !x.id.startsWith('pending')), ...data.messages]);
      if (!activeId) {
        setActiveId(data.threadId);
        primeJson(THREADS_URL, [{ id: data.threadId, title: data.title, updatedAt: new Date().toISOString(), messages: 2 }, ...threads]);
      }
      refresh();
    } else {
      setMessages((m) => m.filter((x) => !x.id.startsWith('pending')));
      setInput(content);
      setFailure(data);
    }
    setSending(false);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this brainstorm?')) return;
    await fetch(`${THREADS_URL}/${id}`, { method: 'DELETE' });
    if (activeId === id) open(null);
    refresh();
  };

  const keep = async (m: Message) => {
    if (savedIds[m.id]) return;
    if (await saveIdea({ title: ideaTitle(m.content), notes: m.content, source: 'brainstorm' })) setSavedIds((s) => ({ ...s, [m.id]: true }));
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    toast.success('Copied');
  };

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-4 min-h-[620px]">
      {/* Threads */}
      <aside className="rounded-[30px] bg-card border border-white/[0.05] p-3 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible">
        <button
          onClick={() => open(null)}
          className={cn(
            'shrink-0 flex items-center gap-2 h-11 px-4 rounded-2xl text-sm font-bold transition-colors',
            activeId === null ? 'bg-white text-background' : 'bg-white/[0.06] hover:bg-white/[0.1]'
          )}
        >
          <MessageSquarePlus className="w-4 h-4" /> New brainstorm
        </button>
        <div className="flex lg:flex-col gap-2 lg:overflow-y-auto lg:max-h-[540px]">
          {threads.map((t) => (
            <div
              key={t.id}
              className={cn(
                'group shrink-0 w-[200px] lg:w-auto flex items-center gap-2 rounded-2xl px-3 py-2.5 cursor-pointer transition-colors',
                activeId === t.id ? 'bg-white/[0.1]' : 'hover:bg-white/[0.05]'
              )}
              onClick={() => open(t.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold truncate">{t.title}</p>
                <p className="text-[11px] text-muted-foreground">{formatRelativeTime(t.updatedAt)}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove(t.id);
                }}
                className="p-1 rounded-lg text-muted-foreground hover:text-rose-400 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                aria-label={`Delete ${t.title}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Conversation */}
      <section className="rounded-[30px] bg-card border border-white/[0.05] flex flex-col overflow-hidden min-h-[560px] max-h-[78vh]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {loadingThread ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white/[0.03] animate-pulse" />)}</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-4 pt-6">
              <SageOrb size={72} />
              <div>
                <p className="font-display font-extrabold text-[26px] tracking-[-0.03em]">What are we cooking?</p>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  Sage knows your numbers, your game plan and your idea board. Throw a half idea at it, or start with one of these.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2 w-full max-w-3xl pt-2 stagger">
                {starters.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => send(s.prompt)}
                    disabled={sending}
                    className="text-left p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.12] transition-colors"
                  >
                    <p className="text-sm font-bold">{s.title}</p>
                    <p className="text-[12px] text-muted-foreground leading-snug mt-1 line-clamp-2">{s.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-[22px] rounded-br-md px-4 py-3 prism-hero text-white text-[14px] leading-relaxed whitespace-pre-wrap">{m.content}</div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-3">
                  <SageOrb size={32} className="shrink-0 mt-0.5" sleeping={false} />
                  <div className="min-w-0 flex-1">
                    {m.pending ? (
                      <div className="flex gap-1.5 py-3" aria-label="Sage is thinking">
                        {[0, 1, 2].map((i) => <span key={i} className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}
                      </div>
                    ) : (
                      <>
                        <Markdown text={m.content} />
                        <div className="flex items-center gap-1 mt-2">
                          <button
                            onClick={() => keep(m)}
                            className={cn('inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-semibold transition-colors', savedIds[m.id] ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]')}
                          >
                            {savedIds[m.id] ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                            {savedIds[m.id] ? 'On your board' : 'Save to board'}
                          </button>
                          <button onClick={() => copy(m.content)} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                            <Copy className="w-3.5 h-3.5" /> Copy
                          </button>
                          {m.model && <span className="text-[10px] text-muted-foreground ml-auto">{m.model}</span>}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            )
          )}
          {failure && <AiNotice code={failure.code} message={failure.error} />}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="p-3 sm:p-4 border-t border-white/[0.05]"
        >
          <div className="flex items-end gap-2 rounded-[24px] bg-white/[0.05] border border-white/[0.08] focus-within:border-white/[0.2] transition-colors p-2 pl-4">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={activeId ? 'Keep going...' : 'Pitch a half baked idea, ask for hooks, plan a series...'}
              className="flex-1 resize-none bg-transparent outline-none text-[14px] leading-relaxed py-2 max-h-40 field-sizing-content"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="w-10 h-10 rounded-full bg-white text-background flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
              aria-label="Send"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 px-2">Enter to send, Shift+Enter for a new line. Every brainstorm is saved.</p>
        </form>
      </section>
    </div>
  );
}
