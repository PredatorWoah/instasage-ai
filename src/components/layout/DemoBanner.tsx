'use client';

import { signOut, useSession } from 'next-auth/react';
import { Sparkles } from 'lucide-react';
import { isDemo } from '@/lib/demo';

// Always visible in the demo, so nobody mistakes the sample brand for real data
export function DemoBanner() {
  const { data } = useSession();
  if (!isDemo(data?.user?.id)) return null;
  return (
    <div role="status" className="relative z-30 max-w-[1480px] mx-auto px-4 sm:px-6 pt-3">
      <div className="glass-panel rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
        <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="flex-1 min-w-[200px] leading-snug"><b>Demo.</b> Made-up data for a sample brand. Look around freely: saving, posting and AI are switched off.</span>
        <button type="button" onClick={() => signOut({ callbackUrl: '/login' })} className="h-8 px-3.5 rounded-full bg-foreground text-background text-[12px] font-bold shrink-0">Exit demo</button>
      </div>
    </div>
  );
}
