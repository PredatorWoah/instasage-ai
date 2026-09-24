'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, ArrowUpDown, Flame } from 'lucide-react';
import { mockPosts } from '@/data/mockPosts';
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
  const [sort, setSort] = useState<SortConfig>({ key: 'performanceScore', direction: 'desc' });

  // Keep search input state in sync with URL search query parameter
  useEffect(() => {
    setSearch(searchParams.get('q') || '');
  }, [searchParams]);

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
    router.push(`${pathname}?${params.toString()}`);
  };

  // Filtered & Sorted posts
  const processedPosts = useMemo(() => {
    let result = [...mockPosts];

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
  }, [searchParams, platform, postType, sort]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Content Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Perform analytical checks, sort, search, and audit your social media content
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
            placeholder="Search captions..."
            className="pl-9 h-9 bg-secondary/40 border-border text-sm"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-3">
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-9 w-36 bg-secondary/40 border-border text-xs">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Platforms</SelectItem>
              <SelectItem value="instagram" className="text-xs">Instagram</SelectItem>
              <SelectItem value="youtube" className="text-xs">YouTube</SelectItem>
              <SelectItem value="facebook" className="text-xs">Facebook</SelectItem>
            </SelectContent>
          </Select>

          <Select value={postType} onValueChange={setPostType}>
            <SelectTrigger className="h-9 w-32 bg-secondary/40 border-border text-xs">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Formats</SelectItem>
              <SelectItem value="reel" className="text-xs">Reel</SelectItem>
              <SelectItem value="carousel" className="text-xs">Carousel</SelectItem>
              <SelectItem value="video" className="text-xs">Video</SelectItem>
              <SelectItem value="post" className="text-xs">Post</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-secondary/20 overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/40">
            <TableRow>
              <TableHead className="w-16 text-xs text-muted-foreground py-2.5">Thumbnail</TableHead>
              <TableHead className="w-24 text-xs text-muted-foreground py-2.5">Platform</TableHead>
              <TableHead className="text-xs text-muted-foreground py-2.5">Caption</TableHead>
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
              <TableHead className="w-28 text-right text-xs text-muted-foreground py-2.5">
                <button onClick={() => handleSort('performanceScore')} className="inline-flex items-center gap-1 hover:text-foreground">
                  Score <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {processedPosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-xs text-muted-foreground">
                  No posts found matching the criteria
                </TableCell>
              </TableRow>
            ) : (
              processedPosts.map((post) => (
                <TableRow key={post.id} className="hover:bg-secondary/30 transition-colors">
                  <TableCell className="py-2">
                    <div className="relative w-8 h-8 rounded overflow-hidden bg-secondary">
                      <Image
                        src={post.thumbnail}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="32px"
                        unoptimized
                      />
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge className={cn('text-[10px] px-1.5 py-0 border', getPlatformColor(post.platform))}>
                      {getPlatformLabel(post.platform)}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 max-w-xs truncate text-xs font-normal">
                    {post.caption}
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
                  <TableCell className="py-2 text-right text-xs text-muted-foreground">
                    {formatNumber(post.saves)}
                  </TableCell>
                  <TableCell className="py-2 text-right text-xs text-muted-foreground">
                    {formatNumber(post.shares)}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <div className="inline-flex items-center gap-1 justify-end">
                      <Flame className={cn('w-3.5 h-3.5 shrink-0', getPerformanceColor(post.performanceScore))} />
                      <span className={cn('text-xs font-bold', getPerformanceColor(post.performanceScore))}>
                        {post.performanceScore}
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
