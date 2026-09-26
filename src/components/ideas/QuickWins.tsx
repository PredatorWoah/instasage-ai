'use client';

import { useState } from 'react';
import { ArrowUpRight, BookmarkPlus, Check, Clock, Zap } from 'lucide-react';
import type { AiRecommendation } from '@/services/ai';
import { useAiResult } from '@/components/ai-assistant/useAiResult';
import { AiNotice } from '@/components/ai-assistant/AiNotice';
import { GeneratedAt } from '@/components/ai-assistant/GeneratedAt';
import { saveIdea } from './saveIdea';
import { cn } from '@/lib/utils';

const PRIORITY = {
  high: 'bg-rose-500/10 text-rose-400',
  medium: 'bg-amber-500/10 text-amber-400',
  low: 'bg-slate-500/10 text-slate-400',
};
const EFFORT = {
  low: { label: 'Quick win', icon: Zap, className: 'text-emerald-400' },
  medium: { label: 'Some effort', icon: Clock, className: 'text-amber-400' },
  high: { label: 'Big lift', icon: Clock, className: 'text-rose-400' },
};
const CATEGORIES = ['all', 'timing', 'content', 'engagement', 'growth'];

export function QuickWins() {
  const { result, failure, loading, generating, generate } = useAiResult<AiRecommendation>('recommendations');
  const [category, setCategory] = useState('all');
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const recs = (result?.items ?? []).filter((r) => category === 'all' || r.category === category);

  const keep = async (rec: AiRecommendation) => {
    if (saved[rec.id]) return;
    if (await saveIdea({ title: rec.title, notes: `${rec.description}\n\nExpected: ${rec.impact} (${rec.estimatedGrowth})`, source: 'recommendation' })) {
      setSaved((s) => ({ ...s, [rec.id]: true }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                'text-xs h-8 px-3.5 rounded-full font-bold capitalize transition-colors shrink-0',
                category === c ? 'bg-white text-background' : 'bg-white/[0.06] text-muted-foreground hover:text-foreground'
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <GeneratedAt createdAt={result?.createdAt} model={result?.model} generating={generating} onRegenerate={generate} />
      </div>

      {failure && <AiNotice code={failure.code} message={failure.error} />}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
        {loading
          ? [0, 1, 2].map((i) => <div key={i} className="h-56 rounded-[30px] bg-card animate-pulse" />)
          : recs.map((rec) => {
              const effort = EFFORT[rec.effort] ?? EFFORT.medium;
              const EffortIcon = effort.icon;
              return (
                <div key={rec.id} className="rounded-[30px] p-5 bg-card border border-white/[0.05] flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full capitalize', PRIORITY[rec.priority] ?? PRIORITY.medium)}>{rec.priority} priority</span>
                    <span className="text-[11px] font-bold text-muted-foreground capitalize">{rec.category}</span>
                  </div>
                  <p className="font-display font-extrabold text-[19px] leading-tight">{rec.title}</p>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{rec.description}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold mt-auto pt-2">
                    <span className={cn('inline-flex items-center gap-1', effort.className)}><EffortIcon className="w-3.5 h-3.5" /> {effort.label}</span>
                    <span className="inline-flex items-center gap-1 text-emerald-400"><ArrowUpRight className="w-3.5 h-3.5" /> {rec.estimatedGrowth}</span>
                  </div>
                  <button
                    onClick={() => keep(rec)}
                    className={cn(
                      'h-9 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors',
                      saved[rec.id] ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.07] hover:bg-white/[0.12]'
                    )}
                  >
                    {saved[rec.id] ? <><Check className="w-3.5 h-3.5" /> On your board</> : <><BookmarkPlus className="w-3.5 h-3.5" /> Save to board</>}
                  </button>
                </div>
              );
            })}
      </div>
    </div>
  );
}
