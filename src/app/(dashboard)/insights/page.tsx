'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Sparkles, Search, CheckCircle2, ShieldAlert, AlertCircle, ArrowUpRight } from 'lucide-react';
import { mockInsights } from '@/data/mockInsights';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const IMPACT_CONFIG = {
  high: { label: 'High Priority', icon: ShieldAlert, className: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  medium: { label: 'Medium Priority', icon: AlertCircle, className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  low: { label: 'Low Priority', icon: CheckCircle2, className: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

const CATEGORY_COLORS: Record<string, string> = {
  timing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  content: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  audience: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  engagement: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  growth: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

function InsightsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [priority, setPriority] = useState<string>('all');

  // Keep search input state in sync with URL search query parameter
  useEffect(() => {
    setSearch(searchParams.get('q') || '');
  }, [searchParams]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set('q', val);
    } else {
      params.delete('q');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const processedInsights = useMemo(() => {
    let result = [...mockInsights];

    // Filter using url query param for consistency with top bar
    const urlQuery = searchParams.get('q') || '';
    if (urlQuery.trim()) {
      const q = urlQuery.toLowerCase();
      result = result.filter(
        (i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
      );
    }

    if (priority !== 'all') {
      result = result.filter((i) => i.impact === priority);
    }

    return result;
  }, [searchParams, priority]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          AI Insights
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Algorithmic audits of your performance and content structure
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/10 p-3 rounded-lg border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search insights..."
            className="pl-9 h-9 bg-secondary/40 border-border text-sm"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {['all', 'high', 'medium', 'low'].map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-md border font-medium capitalize transition-colors',
                priority === p
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {p === 'all' ? 'All Priority' : `${p} Priority`}
            </button>
          ))}
        </div>
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {processedInsights.length === 0 ? (
          <div className="md:col-span-2 text-center py-12 border border-dashed border-border rounded-xl">
            <p className="text-sm text-muted-foreground">No insights found matching your filters.</p>
          </div>
        ) : (
          processedInsights.map((insight) => {
            const config = IMPACT_CONFIG[insight.impact];
            const PriorityIcon = config.icon;
            return (
              <Card key={insight.id} className="bg-secondary/20 border-border flex flex-col justify-between hover:border-border/80 transition-colors">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={cn('flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold', config.className)}>
                      <PriorityIcon className="w-3.5 h-3.5 shrink-0" />
                      {config.label}
                    </div>
                    <Badge className={cn('text-[10px] border-transparent uppercase shrink-0', CATEGORY_COLORS[insight.category])}>
                      {insight.category}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold text-foreground leading-snug">{insight.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {insight.metricValue ? (
                      <div className="inline-flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded">
                        <span className="font-bold">{insight.metricValue}</span>
                        <span>{insight.metric}</span>
                      </div>
                    ) : (
                      <div />
                    )}
                    <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded border border-border">
                      {insight.confidenceScore}% Confidence
                    </span>
                  </div>

                  <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3 space-y-1.5 mt-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                      <ArrowUpRight className="w-3 h-3" />
                      Suggested Action
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {insight.suggestedAction}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-xs text-muted-foreground">Loading AI Insights...</div>}>
      <InsightsPageContent />
    </Suspense>
  );
}
