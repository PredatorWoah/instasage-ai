'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Eye, Heart, MessageCircle, Share2, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNumber, formatRelativeTime, getPlatformColor, getPlatformLabel, getPerformanceColor, getPerformanceLabel } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { Post } from '@/types';

type PostCardProps = {
  post: Post;
};

const TYPE_LABEL: Record<string, string> = {
  reel: 'Reel',
  carousel: 'Carousel',
  post: 'Post',
  video: 'Video',
  story: 'Story',
};

export function PostCard({ post }: PostCardProps) {
  const scoreColor = getPerformanceColor(post.performanceScore);
  const scoreLabel = getPerformanceLabel(post.performanceScore);

  return (
    <Link href={`/content/${encodeURIComponent(post.id)}`} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-indigo-500">
    <Card className="bg-secondary/20 border-border overflow-hidden group hover:border-indigo-500/40 transition-colors h-full">
      {/* Thumbnail */}
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {post.thumbnail && (
          <Image
            src={post.thumbnail}
            alt={post.caption}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            unoptimized
          />
        )}
        {/* Overlay badges */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-2 left-2">
          <Badge className={cn('text-[10px] px-1.5 py-0 border', getPlatformColor(post.platform))}>
            {getPlatformLabel(post.platform)}
          </Badge>
        </div>
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {TYPE_LABEL[post.type] ?? post.type}
          </Badge>
        </div>
        <button className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-black/50 rounded">
          <ExternalLink className="w-3 h-3 text-white" />
        </button>
      </div>

      <CardContent className="p-3">
        {/* Caption */}
        <p className="text-xs text-foreground line-clamp-2 mb-3 leading-relaxed">
          {post.caption}
        </p>

        {/* Metrics row */}
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          <Metric icon={Eye} value={formatNumber(post.views)} label="Views" />
          <Metric icon={Heart} value={formatNumber(post.likes)} label="Likes" />
          <Metric icon={MessageCircle} value={formatNumber(post.comments)} label="Comments" />
          <Metric icon={Share2} value={formatNumber(post.shares)} label="Shares" />
        </div>

        {/* Footer: score + date */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <div className={cn('text-xs font-bold', scoreColor)}>{post.performanceScore.toFixed(1)}%</div>
            <span className={cn('text-[10px]', scoreColor)}>{scoreLabel}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{formatRelativeTime(post.publishedAt)}</span>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}

function Metric({ icon: Icon, value, label }: { icon: React.ElementType; value: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-xs font-medium text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground hidden sm:block">{label}</span>
    </div>
  );
}
