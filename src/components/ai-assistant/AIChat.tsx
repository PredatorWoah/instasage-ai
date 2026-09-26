'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { SageOrb } from './SageOrb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ChatMessage } from '@/types';
import { cn } from '@/lib/utils';
import { useCachedJson } from '@/lib/useCachedJson';

const SUGGESTED_PROMPTS = [
  'What performed best this month?',
  'When should I post next?',
  'How can I grow my engagement?',
];

let nextId = 1;
const newId = () => String(nextId++);

export function AIChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hey, I'm Sage! I've read your synced posts. Ask me what's working, what to post next, or how to grow.",
      timestamp: new Date(),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: settings } = useCachedJson<{ active: string | null; providers: { id: string; label: string; model: string | null }[] } | null>(open ? '/api/settings/ai' : null);
  const activeAi = settings?.providers.find((p) => p.id === settings.active);
  const ai = activeAi ? `${activeAi.label}${activeAi.model ? ` (${activeAi.model})` : ''}` : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, thinking]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || thinking) return;

    const history = messages.slice(1).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { id: newId(), role: 'user', content: text, timestamp: new Date() }]);
    setInput('');
    setThinking(true);

    let reply: string;
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json().catch(() => ({}));
      reply = res.ok ? data.reply : data.error || 'Something went wrong. Try again.';
    } catch {
      reply = 'Could not reach the server. Check your connection and try again.';
    }
    setThinking(false);
    setMessages((prev) => [...prev, { id: newId(), role: 'assistant', content: reply, timestamp: new Date() }]);
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label={open ? 'Close Sage, the AI assistant' : 'Ask Sage, the AI assistant'}
        aria-expanded={open}
        className="sage-button fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 rounded-full"
      >
        <SageOrb sleeping={open} />
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-[92px] right-4 sm:right-6 z-50 w-[calc(100vw-3rem)] max-w-sm bg-card/95 backdrop-blur-xl border border-white/[0.08] rounded-[28px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-rise" style={{ height: 460 }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-2.5 shrink-0">
            <SageOrb size={34} className="shrink-0" />
            <div>
              <p className="text-sm font-display font-extrabold">Sage</p>
              <p className="text-[10px] text-muted-foreground">{ai ? `${ai} · ` : ''}knows your synced posts</p>
            </div>
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
                    {msg.content}
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
