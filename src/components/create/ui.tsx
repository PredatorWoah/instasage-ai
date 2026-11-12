'use client';

import type { ReactNode } from 'react';
import type { BrandKit } from '@/lib/brandKit';
import { cn } from '@/lib/utils';

export type Kit = BrandKit & { saved: boolean };
export type Draft = {
  id: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  postId: string | null;
  updatedAt: string;
  result: { views: number; saves: number; shares: number; performanceScore: number } | null;
};
export type PostRow = { id: string; caption: string; username?: string; type: string; publishedAt: string };

export const field = 'glass-field w-full rounded-2xl px-4 text-[14px] text-foreground placeholder:text-muted-foreground outline-none focus:border-violet-400/70 focus-visible:ring-2 focus-visible:ring-violet-400/40';
export const input = `${field} h-12`;
export const area = `${field} py-3 leading-relaxed resize-y min-h-[110px]`;

export const btn = {
  primary: 'inline-flex items-center justify-center gap-1.5 h-12 px-5 rounded-full bg-foreground text-background text-[13px] font-bold hover:opacity-90 disabled:opacity-40 transition-opacity',
  ghost: 'inline-flex items-center justify-center gap-1.5 h-12 px-5 rounded-full glass-field text-[13px] font-bold hover:bg-ink/[0.12] disabled:opacity-40 transition-colors',
  small: 'inline-flex items-center justify-center h-10 px-4 rounded-full glass-field text-[12px] font-bold hover:bg-ink/[0.12] disabled:opacity-40 transition-colors',
};

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5 min-w-0', className)}>
      <span className="text-[13px] font-bold">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-muted-foreground leading-snug">{hint}</span>}
    </label>
  );
}

export function Panel({ title, sub, children, className, action }: { title?: string; sub?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn('glass-panel rounded-[30px] p-5 sm:p-6 flex flex-col gap-4 min-w-0', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="font-display font-extrabold text-[22px] sm:text-[26px] tracking-[-0.03em] leading-tight">{title}</h2>}
            {sub && <p className="text-[13.5px] text-muted-foreground mt-1 leading-snug">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const when = (iso: string) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(iso));
