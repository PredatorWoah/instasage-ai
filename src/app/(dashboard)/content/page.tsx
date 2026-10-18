'use client';

import { Suspense, useState, useMemo } from 'react';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, ArrowUpDown, Flame, LayoutGrid, Rows3, Download, Bookmark, X, Eye, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { useLocalJson } from '@/lib/useLocalJson';
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
import { cn, daysAgo } from '@/lib/utils';

type SavedView = { name: string; query: string };

const SORT_KEYS: (keyof Post)[] = ['publishedAt', 'views', 'likes', 'comments', 'saves', 'shares', 'performanceScore'];

const RANGES = [
  { value: 'all', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
];

type SortConfig = {
  key: keyof Post;
  direction: 'asc' | 'desc';
};

function ContentLibraryContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filters live in the URL so a view can be bookmarked, shared or saved by name
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const platform = searchParams.get('platform') || 'all';
  const postType = searchParams.get('type') || 'all';
  const range = searchParams.get('range') || 'all';
  const view = searchParams.get('view') === 'grid' ? 'grid' : 'table';
  const sort: SortConfig = {
    key: (SORT_KEYS.includes(searchParams.get('sort') as keyof Post) ? searchParams.get('sort') : 'publishedAt') as keyof Post,
    direction: searchParams.get('dir') === 'asc' ? 'asc' : 'desc',
  };
  const [saved, setSaved] = useLocalJson<SavedView[]>('instasage:content-views', []);
  const setParam = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === '' || v === 'all' || (k === 'view' && v === 'table')) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const setPlatform = (v: string) => setParam({ platform: v });
  const setPostType = (v: string) => setParam({ type: v });
  const { data: postsData } = useCachedJson<Post[]>('/api/posts');
  const { t, mode } = usePlatform();
  const posts = useMemo(() => (postsData === undefined ? null : postsData ?? []), [postsData]);

  // Sorting helper
  const handleSort = (key: keyof Post) => {
    const direction = sort.key === key && sort.direction === 'desc' ? 'asc' : 'desc';
    setParam({ sort: key === 'publishedAt' ? null : key, dir: direction === 'desc' ? null : direction });
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setParam({ q: val });
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

    // Date range
    const days = Number(range);
    if (days > 0) {
      const since = daysAgo(days);
      result = result.filter((p) => new Date(p.publishedAt).getTime() >= since);
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
  }, [searchParams, platform, postType, range, sort.key, sort.direction, posts]);

  const summary = useMemo(() => {
    if (!processedPosts.length) return null;
    const views = processedPosts.reduce((a, p) => a + p.views, 0);
    const eng = processedPosts.reduce((a, p) => a + p.performanceScore, 0) / processedPosts.length;
    return { views, eng };
  }, [processedPosts]);

  const current = searchParams.toString();
  const activeView = saved.find((v) => v.query === current);
  const filtered = !!(searchParams.get('q') || platform !== 'all' || postType !== 'all' || range !== 'all');

  const saveView = () => {
    const name = window.prompt('Name this view', [RANGES.find((r) => r.value === range)?.label, postType !== 'all' ? formatLabel(postType) : '', searchParams.get('q') ?? ''].filter((x) => x && x !== 'All time').join(' · ') || 'My view');
    if (!name?.trim()) return;
    setSaved([...saved.filter((v) => v.name !== name.trim()), { name: name.trim().slice(0, 40), query: current }].slice(-12));
    toast.success(`Saved "${name.trim()}"`);
  };

  const exportCsv = () => {
    const cols: [string, (p: Post) => string | number][] = [
      ['published', (p) => p.publishedAt],
      ['platform', (p) => p.platform],
      ['account', (p) => p.username ?? ''],
      ['format', (p) => p.type],
      ['caption', (p) => p.caption],
      ['views', (p) => p.views],
      ['reach', (p) => p.reach ?? ''],
      ['likes', (p) => p.likes],
      ['comments', (p) => p.comments],
      ['saves', (p) => p.saves],
      ['shares', (p) => p.shares],
      ['engagement_percent', (p) => p.performanceScore.toFixed(2)],
      ['boosted', (p) => (p.isBoosted ? 'yes' : 'no')],
      ['link', (p) => p.permalink ?? ''],
    ];
    const cell = (v: string | number) => {
      const s = String(v);
      return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.map((c) => c[0]).join(','), ...processedPosts.map((p) => cols.map(([, get]) => cell(get(p))).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `instasage-content-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

          <Select value={range} onValueChange={(v) => setParam({ range: v })}>
            <SelectTrigger className="h-9 w-32 bg-secondary/40 border-border text-xs" aria-label="Date range">
              <SelectValue placeholder="Any time" />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={postType} onValueChange={setPostType}>
            <SelectTrigger className="h-9 w-32 bg-secondary/40 border-border text-xs">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Formats</SelectItem>
              {t.formats.map((f) => <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-md border border-border bg-secondary/40 p-0.5" role="group" aria-label="Layout">
            <button type="button" onClick={() => setParam({ view: 'table' })} aria-pressed={view === 'table'} aria-label="Table view" className={cn('p-1.5 rounded', view === 'table' ? 'bg-ink text-background' : 'text-muted-foreground hover:text-foreground')}><Rows3 className="w-4 h-4" /></button>
            <button type="button" onClick={() => setParam({ view: 'grid' })} aria-pressed={view === 'grid'} aria-label="Grid view" className={cn('p-1.5 rounded', view === 'grid' ? 'bg-ink text-background' : 'text-muted-foreground hover:text-foreground')}><LayoutGrid className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Saved views, totals and export */}
      <div className="flex flex-wrap items-center gap-2 -mt-2">
        {saved.map((v) => (
          <span key={v.name} className={cn('inline-flex items-center rounded-full border text-[12px] font-semibold', v.query === current ? 'bg-ink text-background border-ink' : 'bg-ink/[0.04] border-ink/[0.08]')}>
            <button type="button" onClick={() => { setSearch(new URLSearchParams(v.query).get('q') ?? ''); router.replace(v.query ? `${pathname}?${v.query}` : pathname, { scroll: false }); }} className="pl-3 pr-1.5 py-1">{v.name}</button>
            <button type="button" onClick={() => setSaved(saved.filter((x) => x.name !== v.name))} aria-label={`Delete saved view ${v.name}`} className="pr-2 py-1 opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
          </span>
        ))}
        {filtered && !activeView && (
          <button type="button" onClick={saveView} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink/[0.15] px-3 py-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
            <Bookmark className="w-3 h-3" /> Save this view
          </button>
        )}
        <span className="flex-1" />
        {summary && (
          <span className="text-[12px] text-muted-foreground tabular-nums">
            {processedPosts.length} {processedPosts.length === 1 ? t.post : t.posts} · {formatNumber(summary.views)} views · {summary.eng.toFixed(1)}% avg engagement
          </span>
        )}
        <button type="button" onClick={exportCsv} disabled={!processedPosts.length} className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.07] border border-ink/[0.1] px-3 py-1 text-[12px] font-bold hover:bg-ink/[0.12] disabled:opacity-50">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      {view === 'grid' && posts && processedPosts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {processedPosts.map((post) => (
            <Link key={post.id} href={`/content/${encodeURIComponent(post.id)}`} className="group rounded-2xl overflow-hidden bg-card border border-ink/[0.05] hover:border-ink/[0.15] transition-colors">
              <div className={cn('relative bg-[linear-gradient(160deg,#8C7BFF,#FF6F91)]', post.platform === 'youtube' && post.type !== 'short' ? 'aspect-video' : 'aspect-[4/5]')}>
                {post.thumbnail && <Image src={post.thumbnail} alt="" fill unoptimized sizes="(max-width: 640px) 50vw, 240px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />}
                <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white">{formatLabel(post.type)}</span>
                {post.isBoosted && <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/80 text-black">Boosted</span>}
                <span className="on-color absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 to-transparent text-[11px] font-bold text-white flex items-center gap-2.5 tabular-nums">
                  <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(post.views)}</span>
                  <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{formatNumber(post.likes)}</span>
                  <span className={cn('ml-auto inline-flex items-center gap-0.5', getPerformanceColor(post.performanceScore))}><Flame className="w-3 h-3" />{post.performanceScore.toFixed(1)}%</span>
                </span>
              </div>
              <div className="p-2.5">
                <p className="text-[12px] line-clamp-2 leading-snug min-h-[2.5em]">{post.caption || (post.platform === 'youtube' ? 'Untitled video' : 'Untitled post')}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(post.publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Table */}
      <div className={cn('rounded-lg border border-border bg-card overflow-hidden', view === 'grid' && posts && processedPosts.length > 0 && 'hidden')}>
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
