'use client';

import { MessageCircle } from 'lucide-react';
import { askSage } from '@/lib/askSage';

// Opens Sage with a question already asked, from server-rendered pages
export function AskSageButton({ question, label = 'Ask Sage about it' }: { question: string; label?: string }) {
  return (
    <button type="button" onClick={() => askSage(question)} className="inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-foreground text-background text-[13px] font-bold hover:opacity-90 transition-opacity">
      <MessageCircle className="w-4 h-4" /> {label}
    </button>
  );
}
