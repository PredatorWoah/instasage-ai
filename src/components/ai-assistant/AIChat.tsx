'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { withPostLinks } from './SageText';
import { ASK_SAGE } from '@/lib/askSage';
import { Send } from 'lucide-react';
import { SageOrb } from './SageOrb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ChatMessage } from '@/types';
import { cn } from '@/lib/utils';
import { clearJsonCache } from '@/lib/useCachedJson';
import { useRouter } from 'next/navigation';
import { Check, RotateCcw, Undo2, X } from 'lucide-react';
import { AiPicker } from '@/components/ai-assistant/AiPicker';

const SUGGESTED_PROMPTS = [
  'Which 3 posts got the most saves, and why?',
  'Compare my reels and carousels this month',
  'Why did my last post do better or worse?',
  'A number looks wrong',
];

const WELCOME: ChatMessage = {
  id: '0',
  role: 'assistant',
  content: "Hey, I'm Sage! I've read your synced posts. Ask me what's working or what to post next. If a number looks wrong, tell me the right one and I'll fix it.",
  timestamp: new Date(0),
};

let nextId = 1;
const newId = () => String(nextId++);

type ActionResult = { id: string | null; ok: boolean; summary: string; undone?: boolean };
type Message = ChatMessage & { actions?: ActionResult[] };

export function AIChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  // The saved conversation loads the first time the chat opens
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    fetch('/api/ai/chat')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { turns?: { role: 'user' | 'assistant'; content: string; at: string; actions?: ActionResult[] }[] } | null) => {
        if (cancelled) return;
        setLoaded(true);
        const turns = body?.turns ?? [];
        // Anything typed while it loaded stays at the end
        if (turns.length) setMessages((prev) => [WELCOME, ...turns.map((t) => ({ id: newId(), role: t.role, content: t.content, timestamp: new Date(t.at), actions: t.actions })), ...prev.slice(1)]);
      })
      .catch(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  const newChat = async () => {
    if (thinking) return;
    await fetch('/api/ai/chat', { method: 'DELETE' }).catch(() => {});
    setMessages([WELCOME]);
  };
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, thinking]);

  const router = useRouter();

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || thinking) return;

    setMessages((prev) => [...prev, { id: newId(), role: 'user', content: text, timestamp: new Date() }]);
    setInput('');
    setThinking(true);

    let reply: string;
    let actions: ActionResult[] = [];
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      reply = res.ok ? data.reply : data.error || 'Something went wrong. Try again.';
      if (res.ok && Array.isArray(data.actions)) actions = data.actions;
    } catch {
      reply = 'Could not reach the server. Check your connection and try again.';
    }
    setThinking(false);
    setMessages((prev) => [...prev, { id: newId(), role: 'assistant', content: reply, timestamp: new Date(), actions }]);
    // Sage changed something: every page and chart should show it right away
    if (actions.some((a) => a.ok)) {
      clearJsonCache();
      router.refresh();
    }
  }, [thinking, router]);

  const undo = async (msgId: string, actionId: string) => {
    const res = await fetch(`/api/sage/actions/${actionId}/undo`, { method: 'POST' });
    if (!res.ok) return;
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, actions: m.actions?.map((a) => (a.id === actionId ? { ...a, undone: true } : a)) } : m)));
    clearJsonCache();
    router.refresh();
  };

  // "Ask Sage" buttons on any page open the chat, and ask their question when they carry one
  const pending = useRef<string | null>(null);
  useEffect(() => {
    const onAsk = (e: Event) => {
      const question = (e as CustomEvent<string>).detail;
      setOpen(true);
      if (question) pending.current = question;
    };
    window.addEventListener(ASK_SAGE, onAsk);
    return () => window.removeEventListener(ASK_SAGE, onAsk);
  }, []);
  useEffect(() => {
    if (open && pending.current && !thinking) {
      const question = pending.current;
      pending.current = null;
      void sendMessage(question);
    }
  });

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label={open ? 'Close Sage, the AI assistant' : 'Ask Sage, the AI assistant'}
        aria-expanded={open}
        className="sage-button fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-50 rounded-full"
      >
        {/* A little smaller on phones, where it sits over the content */}
        <span className="block max-sm:scale-[0.8] max-sm:origin-bottom-right">
          <SageOrb sleeping={open} />
        </span>
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-[92px] right-4 sm:right-6 z-50 w-[calc(100vw-3rem)] max-w-sm bg-card/95 backdrop-blur-xl border border-ink/[0.08] rounded-[28px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-rise" style={{ height: 460 }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-2.5 shrink-0">
            <SageOrb size={34} className="shrink-0" />
            <div className="min-w-0 mr-auto">
              <p className="text-sm font-display font-extrabold">Sage</p>
              <p className="text-[10px] text-muted-foreground">knows your synced posts</p>
            </div>
            {messages.length > 1 && (
              <button type="button" onClick={newChat} disabled={thinking} aria-label="Start a new chat" title="Start a new chat" className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-ink/[0.08] disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <AiPicker group="chat" compact />
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap',
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-secondary/60 text-foreground rounded-bl-sm'
                    )}
                  >
                    {msg.role === 'assistant' ? withPostLinks(msg.content) : msg.content}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1.5 whitespace-normal">
                        {msg.actions.map((a, i) => (
                          <div key={a.id ?? i} className={cn('flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[11px] leading-snug border', !a.ok ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : a.undone ? 'border-border bg-background/40 text-muted-foreground line-through' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200')}>
                            {a.ok ? <Check className="w-3 h-3 mt-0.5 shrink-0" /> : <X className="w-3 h-3 mt-0.5 shrink-0" />}
                            <span className="flex-1">{a.summary}</span>
                            {a.ok && a.id && !a.undone && (
                              <button type="button" onClick={() => undo(msg.id, a.id!)} className="shrink-0 inline-flex items-center gap-1 font-bold text-foreground hover:underline no-underline">
                                <Undo2 className="w-3 h-3" /> Undo
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="rounded-xl rounded-bl-sm px-3 py-2 text-xs bg-secondary/60 text-muted-foreground animate-pulse">
                    Thinking...
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Suggested prompts */}
          <div className="px-3 py-2 flex gap-1.5 flex-wrap border-t border-border shrink-0">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                disabled={thinking}
                className="text-[10px] px-2 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors border border-border"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-3 pb-3 flex gap-2 shrink-0">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder="Ask anything..."
              className="h-8 text-xs bg-secondary/50 border-border flex-1"
            />
            <Button
              size="icon"
              className="h-8 w-8 bg-indigo-600 hover:bg-indigo-700 shrink-0"
              onClick={() => sendMessage(input)}
              disabled={thinking}
              aria-label="Send"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
