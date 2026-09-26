'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowDown, ArrowUp, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AiNotice } from '@/components/ai-assistant/AiNotice';
import { cn } from '@/lib/utils';
import { formatLabel } from '@/lib/platform';
import { formatNumber, formatRelativeTime, getPerformanceColor, getPerformanceLabel, getPlatformColor, getPlatformLabel } from '@/utils/formatters';
import type { PostAnalysis } from '@/services/ai';

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
  };
  benchmarks: Record<'views' | 'reach' | 'likes' | 'comments' | 'saves' | 'shares' | 'engagement', number> & { posts: number; rank: number };
};

type Analysis = { analysis: PostAnalysis; model: string; createdAt: string };

function StatTile({ label, value, average, percent }: { label: string; value: number; average: number; percent?: boolean }) {
  const diff = average > 0 ? ((value - average) / average) * 100 : 0;
  const up = diff >= 0;
  return (
    <div className="p-3 rounded-lg border border-border bg-secondary/15">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{percent ? `${value.toFixed(1)}%` : formatNumber(value)}</p>
      {average > 0 && (
        <p className={cn('text-[10px] flex items-center gap-0.5 tabular-nums', up ? 'text-emerald-400' : 'text-rose-400')}>
          {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {Math.abs(diff).toFixed(0)}% vs avg {percent ? `${average.toFixed(1)}%` : formatNumber(Math.round(average))}
        </p>
      )}
    </div>
  );
}

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

export function PostAnalyzer({ id }: { id: string }) {
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

  const { post, benchmarks: b } = data;
  const yt = post.platform === 'youtube';
  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/content" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" /> Content Library
      </Link>

      <div className={cn('grid grid-cols-1 gap-6', yt ? 'md:grid-cols-[360px_1fr]' : 'md:grid-cols-[280px_1fr]')}>
        <div className="space-y-3">
          <div className={cn('relative rounded-xl overflow-hidden border border-border bg-secondary', yt && post.type !== 'short' ? 'aspect-video' : yt ? 'aspect-[9/16] max-w-[240px]' : 'aspect-[4/5]')}>
            {post.thumbnail && <Image src={post.thumbnail} alt="" fill className="object-cover" sizes="360px" unoptimized />}
          </div>
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline">
              Open on {getPlatformLabel(post.platform)} <ExternalLink className="w-3 h-3" />
            </a>
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
            {b.rank > 0 && <span className="text-xs text-muted-foreground">· #{b.rank} of {b.posts} {yt ? 'videos' : 'posts'}</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <StatTile label="Views" value={post.views} average={b.views} />
            {post.reach != null && <StatTile label="Reach" value={post.reach} average={b.reach} />}
            <StatTile label="Likes" value={post.likes} average={b.likes} />
            <StatTile label="Comments" value={post.comments} average={b.comments} />
            {!yt && <StatTile label="Saves" value={post.saves} average={b.saves} />}
            {!yt && <StatTile label="Shares" value={post.shares} average={b.shares} />}
            <StatTile label="Engagement" value={post.performanceScore} average={b.engagement} percent />
          </div>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-400" /> AI analysis</CardTitle>
          <div className="flex items-center gap-3">
            {analysis && <span className="text-[11px] text-muted-foreground hidden sm:inline">{formatRelativeTime(analysis.createdAt)} · {analysis.model}</span>}
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
