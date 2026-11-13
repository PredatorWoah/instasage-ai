'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, MessageCircle, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AiNotice } from '@/components/ai-assistant/AiNotice';
import { cn } from '@/lib/utils';
import { formatLabel } from '@/lib/platform';
import { formatNumber, formatRelativeTime, getPerformanceColor, getPerformanceLabel, getPlatformColor, getPlatformLabel } from '@/utils/formatters';
import { GrowthCurve, type Snapshot } from '@/components/charts/GrowthCurve';
import { PostNav } from '@/components/content/PostNav';
import { PostInsights } from '@/components/content/PostInsights';
import type { PostAnalysis } from '@/services/ai';
import { AiPicker } from '@/components/ai-assistant/AiPicker';

type PostData = {
  post: {
    id: string;
    platform: string;
    type: string;
    caption: string;
    thumbnail: string;
    permalink: string | null;
    publishedAt: string;
    views: number;
    reach: number | null;
    likes: number;
    comments: number;
    saves: number;
    shares: number;
    performanceScore: number;
    isBoosted: boolean;
    username: string;
    avgWatchMs: number | null;
    skipRate: number | null;
    facebookViews?: number | null;
  };
  snapshots: Snapshot[];
  benchmarks: Record<'views' | 'reach' | 'likes' | 'comments' | 'saves' | 'shares' | 'engagement', number> & {
    posts: number;
    rank: number;
    avgWatchMs: number | null;
    skipRate: number | null;
    at24: { views: number; hours: number; usual: number | null; compared: number } | null;
  };
};

type Analysis = { analysis: PostAnalysis; model: string; createdAt: string };

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold">{title}</p>
      <ul className="list-disc pl-4 space-y-1 text-sm text-muted-foreground leading-relaxed">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

export function PostAnalyzer({ id, vs }: { id: string; vs?: string }) {
  const [data, setData] = useState<PostData | null | undefined>(undefined);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [failure, setFailure] = useState<{ error: string; code?: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetch(`/api/posts/${id}`).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => setData(null));
    fetch(`/api/ai/post/${id}`).then((r) => (r.ok ? r.json() : null)).then(setAnalysis).catch(() => {});
  }, [id]);

  const analyze = async () => {
    setAnalyzing(true);
    setFailure(null);
    const res = await fetch(`/api/ai/post/${id}`, { method: 'POST' });
    const body = await res.json().catch(() => ({ error: 'Unexpected response' }));
    if (res.ok) setAnalysis(body);
    else setFailure(body);
    setAnalyzing(false);
  };

  if (data === undefined) return <div className="h-96 rounded-xl border border-border bg-secondary/10 animate-pulse" />;
  if (data === null) {
    return (
      <div className="space-y-4">
        <Link href="/content" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="w-3.5 h-3.5" /> Content Library</Link>
        <p className="text-sm text-muted-foreground">This post was not found. It may have been removed; try syncing again.</p>
      </div>
    );
  }

  const { post, snapshots, benchmarks: b } = data;
  const yt = post.platform === 'youtube';
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <Link href="/content" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" /> Content Library
        </Link>
        <PostNav id={post.id} />
      </div>

      <div className={cn('grid grid-cols-1 gap-6', yt ? 'md:grid-cols-[360px_1fr]' : 'md:grid-cols-[280px_1fr]')}>
        <div className="space-y-3">
          <div className={cn('relative rounded-xl overflow-hidden border border-border bg-secondary', yt && post.type !== 'short' ? 'aspect-video' : yt ? 'aspect-[9/16] max-w-[200px] md:max-w-[240px]' : 'aspect-[4/5] max-w-[200px] md:max-w-none')}>
            {post.thumbnail && <Image src={post.thumbnail} alt="" fill className="object-cover" sizes="360px" unoptimized />}
          </div>
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline">
              Open on {getPlatformLabel(post.platform)} <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <Link href={`/create?from=${encodeURIComponent(post.id)}`} className="flex items-center gap-1 text-xs text-indigo-400 hover:underline">
            Write a caption like this <Sparkles className="w-3 h-3" />
          </Link>
          {post.platform === 'instagram' && (
            <Link href={`/comments?post=${encodeURIComponent(post.id)}`} className="flex items-center gap-1 text-xs text-indigo-400 hover:underline">
              Reply to comments ({post.comments}) <MessageCircle className="w-3 h-3" />
            </Link>
          )}
        </div>

        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn('text-[10px] border', getPlatformColor(post.platform))}>{getPlatformLabel(post.platform)}</Badge>
            <Badge variant="outline" className="text-[10px]">{formatLabel(post.type)}</Badge>
            {post.isBoosted && <Badge className="text-[10px] border bg-amber-500/10 text-amber-400 border-amber-500/20">Boosted</Badge>}
            <span className="text-xs text-muted-foreground">
              @{post.username} · {new Date(post.publishedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · {formatRelativeTime(post.publishedAt)}
            </span>
          </div>
          {post.isBoosted && (
            <p className="text-xs text-amber-400/90 bg-amber-500/5 border border-amber-500/15 rounded-md px-3 py-2">
              This post was promoted. Instagram&apos;s API only reports its organic results, so views and likes here can be lower than in the Instagram app, which adds the paid ones.
            </p>
          )}
          <p className={cn('leading-relaxed whitespace-pre-wrap', yt ? 'text-lg font-bold' : 'text-sm')}>{post.caption || <span className="text-muted-foreground">{yt ? 'Untitled video' : 'No caption'}</span>}</p>
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-bold', getPerformanceColor(post.performanceScore))}>{post.performanceScore.toFixed(1)}% engagement</span>
            <span className={cn('text-xs', getPerformanceColor(post.performanceScore))}>{getPerformanceLabel(post.performanceScore)}</span>
          </div>
          <PostInsights post={post} averages={b} initialVs={vs} />
        </div>
      </div>

      {snapshots.length >= 2 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-1 pt-4 px-5 space-y-1">
            <CardTitle className="text-sm font-semibold">How it grew</CardTitle>
            {b.at24 && (
              <p className="text-xs text-muted-foreground">
                At {b.at24.hours}h old it had <span className="text-foreground font-semibold tabular-nums">{formatNumber(b.at24.views)}</span> views
                {b.at24.usual != null && (
                  <>
                    {' '}vs <span className="tabular-nums">{formatNumber(b.at24.usual)}</span> for your usual post at that age{' '}
                    <span className={b.at24.views >= b.at24.usual ? 'text-emerald-400' : 'text-rose-400'}>
                      ({b.at24.usual > 0 ? `${b.at24.views >= b.at24.usual ? '+' : ''}${Math.round(((b.at24.views - b.at24.usual) / b.at24.usual) * 100)}%` : 'new high'})
                    </span>
                  </>
                )}
                .
              </p>
            )}
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <GrowthCurve data={snapshots} />
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-400" /> AI analysis</CardTitle>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {analysis && <span className="text-[11px] text-muted-foreground hidden sm:inline">{formatRelativeTime(analysis.createdAt)} · {analysis.model}</span>}
            <AiPicker group="analysis" compact />
            <Button size="sm" onClick={analyze} disabled={analyzing} className="text-xs h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700">
              <RefreshCw className={cn('w-3.5 h-3.5', analyzing && 'animate-spin')} />
              {analyzing ? 'Analyzing...' : analysis ? 'Re-analyze' : 'Analyze this post'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          {failure && <AiNotice code={failure.code} message={failure.error} />}
          {analysis ? (
            <>
              <p className="text-sm font-medium">{analysis.analysis.verdict}</p>
              {analysis.analysis.bestFor && <Badge className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">Best for: {analysis.analysis.bestFor}</Badge>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <List title="Why it performed this way" items={analysis.analysis.whyItPerformed} />
                <List title="What to improve" items={analysis.analysis.improve} />
                <List title="Next post ideas" items={analysis.analysis.nextPostIdeas} />
              </div>
            </>
          ) : (
            !failure && <p className="text-sm text-muted-foreground">Get the AI&apos;s take on this post&apos;s caption, format and timing, compared with your other posts.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
