'use client';

import { ExportAnalysis } from '@/components/export/ExportAnalysis';
import { MessageCircle, Sparkles, Zap } from 'lucide-react';
import { askSage } from '@/lib/askSage';
import { usePeriod } from '@/lib/usePeriod';
import { cn } from '@/lib/utils';
import type { Insight } from '@/services/ai';
import { AiNotice } from './AiNotice';
import { GeneratedAt } from './GeneratedAt';
import { useAiResult } from './useAiResult';
import { PatternsView } from './PatternsView';

const IMPACT_STYLE: Record<string, string> = {
  high: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  low: 'bg-slate-500/10 text-slate-400 border-slate-500/25',
};

const why = (i: Insight) => `About your insight "${i.title}": ${i.description} Why is this happening, and what exactly should I do this week?`;

function ImpactBadge({ impact }: { impact: string }) {
  return <span className={cn('text-[10.5px] font-bold border rounded-full px-2 py-0.5 shrink-0 capitalize', IMPACT_STYLE[impact] ?? IMPACT_STYLE.low)}>{impact} impact</span>;
}

export function InsightsView() {
  const { result, failure, loading, generating, generate } = useAiResult<Insight>('insights');
  const { label } = usePeriod();
  const [lead, ...rest] = result?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">AI Insights</h1>
          <p className="text-[15px] text-muted-foreground mt-3">What is and isn&apos;t working in {label.toLowerCase()}, from real patterns in your posts. Spot a wrong number? Tell Sage the right one and it fixes it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start">
          <ExportAnalysis />
          <GeneratedAt createdAt={result?.createdAt} model={result?.model} generating={generating} onRegenerate={generate} />
        </div>
      </div>

      {failure && <AiNotice code={failure.code} message={failure.error} />}

      {loading ? (
        <div className="grid gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl border border-border bg-secondary/10 animate-pulse" />)}
          <p className="text-xs text-muted-foreground">Analyzing your posts. This takes 10 to 30 seconds depending on the model.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {lead && (
            <article className="relative overflow-hidden rounded-[30px] prism-hero p-6 sm:p-8 flex flex-col gap-3 text-white">
              <div aria-hidden className="absolute right-[12%] -top-32 w-[360px] h-[360px] rounded-full bg-[radial-gradient(closest-side,rgba(255,224,102,0.5),transparent)]" />
              <div className="relative flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-chip text-[11px] font-extrabold tracking-[0.08em] uppercase"><Sparkles className="w-3 h-3" /> The big one</span>
                {lead.category && <span className="px-3 py-1 rounded-full glass-chip text-[11px] font-bold capitalize">{lead.category}</span>}
              </div>
              <h2 className="relative font-display font-extrabold text-[28px] sm:text-[40px] leading-[1.02] tracking-[-0.035em] text-balance max-w-[820px]">{lead.title}</h2>
              <p className="relative text-[15px] leading-relaxed text-white/90 max-w-[760px]">{lead.description}</p>
              <button type="button" onClick={() => askSage(why(lead))} className="relative self-start mt-1 inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-white text-[#0A0A0F] text-[13px] font-bold">
                <MessageCircle className="w-4 h-4" /> Ask Sage why
              </button>
            </article>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
            {rest.map((insight, i) => (
              <article key={i} className="rounded-[26px] bg-card border border-ink/[0.05] p-5 flex flex-col gap-2.5">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="w-9 h-9 shrink-0 rounded-xl bg-indigo-500/10 flex items-center justify-center"><Zap className="w-4 h-4 text-indigo-400" /></span>
                  <h3 className="flex-1 text-[15px] font-bold leading-snug">{insight.title}</h3>
                  <ImpactBadge impact={insight.impact} />
                </div>
                <p className="text-[13.5px] text-muted-foreground leading-relaxed">{insight.description}</p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  {insight.category ? <span className="text-[10.5px] uppercase tracking-wider font-bold text-muted-foreground">{insight.category}</span> : <span />}
                  <button type="button" onClick={() => askSage(why(insight))} className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full bg-ink/[0.06] hover:bg-ink/[0.1] text-[12px] font-bold">
                    <MessageCircle className="w-3.5 h-3.5" /> Ask why
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      <PatternsView />
    </div>
  );
}
