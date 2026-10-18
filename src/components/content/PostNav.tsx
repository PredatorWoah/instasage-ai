'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { cn } from '@/lib/utils';

type Item = { id: string; publishedAt: string };

// Newer / older post buttons (and the ← → keys) so you can flip through posts without going back
export function PostNav({ id }: { id: string }) {
  const router = useRouter();
  const { data } = useCachedJson<Item[]>('/api/posts');
  const list = data ?? [];
  const i = list.findIndex((p) => p.id === id);
  const newer = i > 0 ? list[i - 1] : null;
  const older = i >= 0 && i < list.length - 1 ? list[i + 1] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if (e.key === 'ArrowLeft' && newer) router.push(`/content/${encodeURIComponent(newer.id)}`);
      if (e.key === 'ArrowRight' && older) router.push(`/content/${encodeURIComponent(older.id)}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [newer, older, router]);

  if (i < 0) return null;
  const btn = 'inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12px] font-bold border transition-colors';
  const on = 'bg-ink/[0.05] border-ink/[0.08] hover:bg-ink/[0.1]';
  const off = 'border-transparent text-muted-foreground/50 pointer-events-none';
  return (
    <div className="flex items-center gap-1.5">
      <span className="hidden sm:inline text-[11px] text-muted-foreground mr-1 tabular-nums">{i + 1} of {list.length}</span>
      <Link href={newer ? `/content/${encodeURIComponent(newer.id)}` : '#'} aria-disabled={!newer} title="Newer post (←)" className={cn(btn, newer ? on : off)}>
        <ChevronLeft className="w-3.5 h-3.5" /> Newer
      </Link>
      <Link href={older ? `/content/${encodeURIComponent(older.id)}` : '#'} aria-disabled={!older} title="Older post (→)" className={cn(btn, older ? on : off)}>
        Older <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
