'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Lightbulb, Search, CheckCircle, Zap, Clock, ArrowUpRight, Play } from 'lucide-react';
import type { AiRecommendation } from '@/services/ai';
import { useAiResult } from '@/components/ai-assistant/useAiResult';
import { AiNotice } from '@/components/ai-assistant/AiNotice';
import { GeneratedAt } from '@/components/ai-assistant/GeneratedAt';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PRIORITY_CONFIG = {
  high: { label: 'High Priority', className: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  medium: { label: 'Medium Priority', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  low: { label: 'Low Priority', className: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

const DIFFICULTY_CONFIG = {
  low: { label: 'Quick Win', icon: Zap, className: 'text-emerald-400 border-emerald-500/10 bg-emerald-500/5' },
  medium: { label: 'Some Effort', icon: Clock, className: 'text-amber-400 border-amber-500/10 bg-amber-500/5' },
  high: { label: 'High Effort', icon: Clock, className: 'text-rose-400 border-rose-500/10 bg-rose-500/5' },
};

function RecommendationsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [appliedIds, setAppliedIds] = useState<Record<string, boolean>>({});
  const { result, failure, loading, generating, generate } = useAiResult<AiRecommendation>('recommendations');

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
    router.replace(`${pathname}?${params.toString()}`);
  };

  // Filter recommendations
  const filteredRecs = useMemo(() => {
    let recs = [...(result?.items ?? [])];

    // Filter using url query param for consistency with top bar
    const urlQuery = searchParams.get('q') || '';
    if (urlQuery.trim()) {
      const q = urlQuery.toLowerCase();
      recs = recs.filter(
        (r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
      );
    }

    if (activeCategory !== 'all') {
      recs = recs.filter((r) => r.category === activeCategory);
    }

    return recs;
  }, [searchParams, activeCategory, result]);

  const handleAction = (id: string) => {
    setAppliedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const categories = ['all', 'timing', 'content', 'engagement', 'growth'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em] flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            Recommendations
          </h1>
          <p className="text-[15px] text-muted-foreground mt-3">
            Next steps Gemini suggests from your recent posts
          </p>
        </div>
        <GeneratedAt createdAt={result?.createdAt} model={result?.model} generating={generating} onRegenerate={generate} />
      </div>

      {failure && <AiNotice code={failure.code} message={failure.error} />}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/10 p-3 rounded-lg border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search recommendations..."
            className="pl-9 h-9 bg-secondary/40 border-border text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 shrink-0">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-md border font-medium capitalize transition-colors shrink-0',
                activeCategory === c
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        {loading ? (
          [0, 1, 2, 3].map((i) => <div key={i} className="h-56 rounded-xl border border-border bg-secondary/10 animate-pulse" />)
        ) : filteredRecs.length === 0 ? (
          result && (
            <div className="md:col-span-2 text-center py-12 border border-dashed border-border rounded-xl">
              <p className="text-sm text-muted-foreground">No recommendations match this filter.</p>
            </div>
          )
        ) : (
          filteredRecs.map((rec) => {
            const priority = PRIORITY_CONFIG[rec.priority] ?? PRIORITY_CONFIG.medium;
            const difficulty = DIFFICULTY_CONFIG[rec.effort] ?? DIFFICULTY_CONFIG.medium;
            const DiffIcon = difficulty.icon;
            const isApplied = appliedIds[rec.id];

            return (
              <Card key={rec.id} className="bg-card border-border flex flex-col justify-between hover:border-border/80 transition-colors">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className={cn('text-[10px] border', priority.className)}>
                      {priority.label}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] uppercase border-border capitalize">
                      {rec.category}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold text-foreground leading-snug">{rec.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/50">
                    <div className="flex items-center gap-1.5">
                      <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border font-medium', difficulty.className)}>
                        <DiffIcon className="w-3 h-3" />
                        {difficulty.label}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/15">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold">{rec.impact}</span>
                    </div>

                    <div className="flex items-center gap-1 text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/15">
                      <span className="text-[10px] font-semibold">{rec.estimatedGrowth}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleAction(rec.id)}
                    variant={isApplied ? 'outline' : 'default'}
                    size="sm"
                    className={cn(
                      'w-full text-xs h-8 gap-1.5 transition-all mt-1',
                      isApplied
                        ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    )}
                  >
                    {isApplied ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" /> Done
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" /> Mark as done
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function RecommendationsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-xs text-muted-foreground">Loading Recommendations...</div>}>
      <RecommendationsPageContent />
    </Suspense>
  );
}
