'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ChatMessage } from '@/types';
import { cn } from '@/lib/utils';

const SUGGESTED_PROMPTS = [
  'What performed best this month?',
  'When should I post next?',
  'How can I grow my engagement?',
];

const MOCK_RESPONSES: Record<string, string> = {
  default: "Based on your analytics, your Reels under 30 seconds are outperforming longer content by 43%. I'd recommend posting your next Reel on Tuesday around 7 PM for maximum reach. Would you like a full content calendar suggestion?",
  engagement: "Your engagement rate of 6.8% is above the industry average of ~3.5% for your niche. The biggest driver is carousel posts — they get 2.8× more saves. I'd suggest creating 2 carousels per week to sustain this.",
  post: "Your optimal posting window is Tuesday 7–9 PM based on 30 days of audience activity data. Wednesdays at 12 PM are a secondary peak. Aim for at least 4–5 posts per week across all platforms.",
  growth: "To accelerate growth, focus on three things: (1) cross-post your top Instagram Reels to YouTube Shorts, (2) use trending audio on your next Reel, and (3) reply to comments within 30 minutes to boost algorithmic reach by ~29%.",
};

export function AIChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hi! I'm your InstaSage AI assistant. Ask me anything about your performance, content strategy, or growth opportunities.",
      timestamp: new Date(),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      const lower = text.toLowerCase();
      let response = MOCK_RESPONSES.default;
      if (lower.includes('engag')) response = MOCK_RESPONSES.engagement;
      if (lower.includes('post') || lower.includes('when')) response = MOCK_RESPONSES.post;
      if (lower.includes('grow') || lower.includes('follower')) response = MOCK_RESPONSES.growth;

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: new Date() },
      ]);
    }, 800);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/50 flex items-center justify-center transition-colors"
      >
        {open ? <X className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-white" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-22 right-6 z-50 w-80 bg-background border border-border rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden" style={{ height: 420 }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold">InstaSage AI</p>
              <p className="text-[10px] text-emerald-400">● Online</p>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3">
            <div ref={scrollRef} className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-secondary/60 text-foreground rounded-bl-sm'
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Suggested prompts */}
          <div className="px-3 py-2 flex gap-1.5 flex-wrap border-t border-border shrink-0">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
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
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
