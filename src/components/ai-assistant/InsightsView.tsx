'use client';

import { Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Insight } from '@/services/ai';
import { AiNotice } from './AiNotice';
import { GeneratedAt } from './GeneratedAt';
import { useAiResult } from './useAiResult';

const IMPACT_STYLE: Record<string, string> = {
  high: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

export function InsightsView() {
  const { result, failure, loading, generating, generate } = useAiResult<Insight>('insights');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">AI Insights</h1>
          <p className="text-[15px] text-muted-foreground mt-3">Your AI&apos;s read on what is and isn&apos;t working, worked out from real patterns in your posts</p>
        </div>
        <GeneratedAt createdAt={result?.createdAt} model={result?.model} generating={generating} onRegenerate={generate} />
      </div>

      {failure && <AiNotice code={failure.code} message={failure.error} />}

      {loading ? (
        <div className="grid gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl border border-border bg-secondary/10 animate-pulse" />)}
          <p className="text-xs text-muted-foreground">Analyzing your posts. This takes 10 to 30 seconds depending on the model.</p>
        </div>
      ) : (
        <div className="grid gap-4 stagger">
          {result?.items.map((insight, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-5 flex gap-4">
                <div className="w-10 h-10 shrink-0 rounded-full bg-indigo-500/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h3 className="text-sm font-semibold">{insight.title}</h3>
                    <Badge className={cn('text-[10px] border shrink-0 capitalize', IMPACT_STYLE[insight.impact] ?? IMPACT_STYLE.low)}>
                      {insight.impact} impact
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{insight.description}</p>
                  {insight.category && <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">{insight.category}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
