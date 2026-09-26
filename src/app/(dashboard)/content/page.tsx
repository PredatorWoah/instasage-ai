'use client';

import { Suspense, useState, useMemo } from 'react';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, ArrowUpDown, Flame } from 'lucide-react';
import Link from 'next/link';
import { useCachedJson } from '@/lib/useCachedJson';
import { usePlatform } from '@/lib/usePlatform';
import { formatLabel } from '@/lib/platform';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatNumber,
  getPlatformColor,
  getPlatformLabel,
  getPerformanceColor,
} from '@/utils/formatters';
import type { Post } from '@/types';
import { cn } from '@/lib/utils';

type SortConfig = {
  key: keyof Post;
  direction: 'asc' | 'desc';
};

function ContentLibraryContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [platform, setPlatform] = useState<string>('all');
  const [postType, setPostType] = useState<string>('all');
  const [sort, setSort] = useState<SortConfig>({ key: 'publishedAt', direction: 'desc' });
  const { data: postsData } = useCachedJson<Post[]>('/api/posts');
  const { t, mode } = usePlatform();
  const posts = useMemo(() => (postsData === undefined ? null : postsData ?? []), [postsData]);

  // Sorting helper
  const handleSort = (key: keyof Post) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

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

  // Filtered & Sorted posts
  const processedPosts = useMemo(() => {
    let result = [...(posts ?? [])];

    // Search filter (using url parameter or local input state)
    const urlQuery = searchParams.get('q') || '';
    if (urlQuery.trim()) {
      const q = urlQuery.toLowerCase();
      result = result.filter((p) => p.caption.toLowerCase().includes(q));
    }

    // Platform filter
    if (platform !== 'all') {
      result = result.filter((p) => p.platform === platform);
    }

    // Post Type filter
    if (postType !== 'all') {
      result = result.filter((p) => p.type === postType);
    }

    // Sorting logic
    const { key, direction } = sort;
    result.sort((a, b) => {
      let valA = a[key];
      let valB = b[key];

      if (key === 'publishedAt') {
        valA = new Date(a.publishedAt).getTime();
        valB = new Date(b.publishedAt).getTime();
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return direction === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return direction === 'asc' ? valA - valB : valB - valA;
      }

      return 0;
    });

    return result;
  }, [searchParams, platform, postType, sort, posts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">Content Library</h1>
        <p className="text-[15px] text-muted-foreground mt-3">
          {t.yt ? 'Every video and Short, sortable by views, likes and engagement' : 'Sort, search and open any post for an AI breakdown'}
        </p>
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-secondary/10 p-3 rounded-lg border border-border">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t.yt ? 'Search titles...' : 'Search captions...'}
            className="pl-9 h-9 bg-secondary/40 border-border text-sm"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-3">
          {mode === 'mixed' && <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-9 w-36 bg-secondary/40 border-border text-xs">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Platforms</SelectItem>
              <SelectItem value="instagram" className="text-xs">Instagram</SelectItem>
              <SelectItem value="youtube" className="text-xs">YouTube</SelectItem>
            </SelectContent>
          </Select>}

          <Select value={postType} onValueChange={setPostType}>
            <SelectTrigger className="h-9 w-32 bg-secondary/40 border-border text-xs">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Formats</SelectItem>
              {t.formats.map((f) => <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/40">
            <TableRow>
              <TableHead className="w-16 text-xs text-muted-foreground py-2.5">Thumbnail</TableHead>
              <TableHead className="w-24 text-xs text-muted-foreground py-2.5">Platform</TableHead>
              <TableHead className="text-xs text-muted-foreground py-2.5">{t.yt ? 'Title' : 'Caption'}</TableHead>
              <TableHead className="w-24 text-xs text-muted-foreground py-2.5">
                <button onClick={() => handleSort('publishedAt')} className="inline-flex items-center gap-1 hover:text-foreground">
                  Posted <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
              <TableHead className="w-24 text-right text-xs text-muted-foreground py-2.5">
                <button onClick={() => handleSort('views')} className="inline-flex items-center gap-1 hover:text-foreground">
                  Views <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
              <TableHead className="w-20 text-right text-xs text-muted-foreground py-2.5">
                <button onClick={() => handleSort('likes')} className="inline-flex items-center gap-1 hover:text-foreground">
                  Likes <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
              <TableHead className="w-20 text-right text-xs text-muted-foreground py-2.5">
                <button onClick={() => handleSort('comments')} className="inline-flex items-center gap-1 hover:text-foreground">
                  Comments <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
{t.hasSavesShares && (<>
              <TableHead className="w-20 text-right text-xs text-muted-foreground py-2.5">
                <button onClick={() => handleSort('saves')} className="inline-flex items-center gap-1 hover:text-foreground">
                  Saves <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
              <TableHead className="w-20 text-right text-xs text-muted-foreground py-2.5">
                <button onClick={() => handleSort('shares')} className="inline-flex items-center gap-1 hover:text-foreground">
                  Shares <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
              </>)}
              <TableHead className="w-28 text-right text-xs text-muted-foreground py-2.5">
                <button onClick={() => handleSort('performanceScore')} className="inline-flex items-center gap-1 hover:text-foreground">
                  Eng. % <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {posts === null ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-xs text-muted-foreground">
                  Loading posts...
                </TableCell>
              </TableRow>
            ) : posts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-xs text-muted-foreground">
                  No posts yet. Connect an account and press Sync on the{' '}
                  <Link href="/accounts" className="text-indigo-400 hover:underline">Accounts page</Link>.
                </TableCell>
              </TableRow>
            ) : processedPosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-xs text-muted-foreground">
                  No posts match these filters
                </TableCell>
              </TableRow>
            ) : (
              processedPosts.map((post) => (
                <TableRow
                  key={post.id}
                  onClick={() => router.push(`/content/${encodeURIComponent(post.id)}`)}
                  className="hover:bg-secondary/30 transition-colors cursor-pointer"
                  title="Open post analysis"
                >
                  <TableCell className="py-2">
                    <div className={cn('relative h-8 rounded overflow-hidden bg-secondary', post.platform === 'youtube' ? 'w-14' : 'w-8')}>
                      {post.thumbnail && (
                        <Image
                          src={post.thumbnail}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                          unoptimized
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col items-start gap-1">
                      <Badge className={cn('text-[10px] px-1.5 py-0 border', getPlatformColor(post.platform))}>
                        {getPlatformLabel(post.platform)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{formatLabel(post.type)}</span>
                      {post.isBoosted && (
                        <Badge className="text-[9px] px-1.5 py-0 border bg-amber-500/10 text-amber-400 border-amber-500/20" title="Promoted post: stats are organic only">
                          Boosted
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 max-w-xs truncate text-xs font-normal">
                    <Link
                      href={`/content/${encodeURIComponent(post.id)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-indigo-400"
                    >
                      {post.caption || (post.platform === 'youtube' ? 'Untitled video' : 'Untitled post')}
                    </Link>
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                    {new Date(post.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })}
                  </TableCell>
                  <TableCell className="py-2 text-right text-xs font-medium">
                    {formatNumber(post.views)}
                  </TableCell>
                  <TableCell className="py-2 text-right text-xs text-muted-foreground">
                    {formatNumber(post.likes)}
                  </TableCell>
                  <TableCell className="py-2 text-right text-xs text-muted-foreground">
                    {formatNumber(post.comments)}
                  </TableCell>
                  {t.hasSavesShares && (<>
                  <TableCell className="py-2 text-right text-xs text-muted-foreground">
                    {formatNumber(post.saves)}
                  </TableCell>
                  <TableCell className="py-2 text-right text-xs text-muted-foreground">
                    {formatNumber(post.shares)}
                  </TableCell>
                  </>)}
                  <TableCell className="py-2 text-right">
                    <div className="inline-flex items-center gap-1 justify-end">
                      <Flame className={cn('w-3.5 h-3.5 shrink-0', getPerformanceColor(post.performanceScore))} />
                      <span className={cn('text-xs font-bold', getPerformanceColor(post.performanceScore))}>
                        {post.performanceScore.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function ContentPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-xs text-muted-foreground">Loading Content Library...</div>}>
      <ContentLibraryContent />
    </Suspense>
  );
}
