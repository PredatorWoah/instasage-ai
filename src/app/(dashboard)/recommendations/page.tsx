'use client';

import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Compass, KanbanSquare, MessagesSquare, Zap } from 'lucide-react';
import { GamePlanView } from '@/components/ideas/GamePlanView';
import { Brainstorm } from '@/components/ideas/Brainstorm';
import { IdeaBoard } from '@/components/ideas/IdeaBoard';
import { QuickWins } from '@/components/ideas/QuickWins';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'plan', label: 'Game plan', short: 'Plan', icon: Compass, blurb: 'Do\'s, don\'ts and the next 30 days, worked out from your numbers' },
  { id: 'brainstorm', label: 'Brainstorm', short: 'Chat', icon: MessagesSquare, blurb: 'Think out loud with Sage. Every conversation is saved' },
  { id: 'board', label: 'Idea board', short: 'Board', icon: KanbanSquare, blurb: 'Everything you kept, from idea to posted' },
  { id: 'quick', label: 'Quick wins', short: 'Wins', icon: Zap, blurb: 'Small moves you can make this week' },
] as const;

function IdeasStudio() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get('tab')) ?? TABS[0];

  const select = (id: string) => router.replace(id === 'plan' ? pathname : `${pathname}?tab=${id}`, { scroll: false });

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">Ideas Studio</h1>
          <p className="text-[15px] text-muted-foreground mt-3">{tab.blurb}</p>
        </div>
        <div role="tablist" aria-label="Ideas Studio" className="grid grid-cols-4 lg:flex gap-1 p-1 rounded-full bg-white/[0.05] border border-white/[0.06] self-start w-full lg:w-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => select(t.id)}
                className={cn(
                  'flex items-center justify-center gap-1 sm:gap-1.5 h-10 px-1.5 sm:px-4 rounded-full text-[12px] sm:text-[13px] font-bold transition-all whitespace-nowrap',
                  active ? 'bg-white text-background shadow-[0_6px_24px_rgba(255,255,255,0.15)]' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div key={tab.id} className="animate-rise">
        {tab.id === 'plan' && <GamePlanView />}
        {tab.id === 'brainstorm' && <Brainstorm />}
        {tab.id === 'board' && <IdeaBoard />}
        {tab.id === 'quick' && <QuickWins />}
      </div>
    </div>
  );
}

export default function IdeasPage() {
  return (
    <Suspense fallback={<div className="h-96 rounded-[30px] bg-card animate-pulse" />}>
      <IdeasStudio />
    </Suspense>
  );
}
