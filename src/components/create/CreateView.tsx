'use client';

import { useState } from 'react';
import { PenLine } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { usePlatform } from '@/lib/usePlatform';
import { cn } from '@/lib/utils';
import { BrandKitEditor } from './BrandKitEditor';
import { BriefBuilder } from './BriefBuilder';
import { CaptionLab } from './CaptionLab';
import type { Draft, Kit, PostRow } from './ui';

const TABS = [
  { id: 'caption', label: 'Caption lab' },
  { id: 'briefs', label: 'Briefs' },
  { id: 'kit', label: 'Brand kit' },
] as const;
type Tab = (typeof TABS)[number]['id'];

// Create: write captions and briefs to each account's own brand kit
export function CreateView() {
  const { profiles, selected, loaded } = usePlatform();
  const [tab, setTab] = useState<Tab>('caption');
  const [picked, setPicked] = useState<string | null>(null);

  // With one account in the top switcher, that is the account. With "all", choose here.
  const account = selected !== 'all' ? selected : profiles.find((p) => p.id === picked)?.id ?? profiles[0]?.id ?? null;
  const current = profiles.find((p) => p.id === account);

  const { data: kit, refresh: reloadKit } = useCachedJson<Kit>(account ? `/api/brand-kit?account=${account}` : null);
  const { data: drafts, refresh: reloadDrafts } = useCachedJson<{ drafts: Draft[] }>(account ? `/api/creative?account=${account}` : null);
  const { data: allPosts } = useCachedJson<(PostRow & { username?: string })[]>(account ? '/api/posts' : null);
  const posts = (allPosts ?? []).filter((p) => !current || p.username === current.username);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h1 className="font-display font-extrabold text-[40px] sm:text-[60px] leading-[0.92] tracking-[-0.05em]">Create.</h1>
        <p className="text-[15px] text-muted-foreground max-w-[640px]">Captions and briefs written to each account&apos;s own rules. Sage drafts, the checks keep it on brand, and saved captions link to the post they became.</p>
      </div>

      {loaded && profiles.length === 0 && (
        <p className="glass-panel rounded-[24px] p-5 text-[14px] text-muted-foreground">Connect an account first on the Accounts page, then each account gets its own brand kit here.</p>
      )}

      {account && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div role="tablist" aria-label="Create sections" className="flex gap-1 p-1 rounded-full glass-field max-w-full overflow-x-auto">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn('h-11 px-4 sm:px-5 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors', tab === t.id ? 'bg-foreground text-background' : 'hover:bg-ink/[0.1]')}>{t.label}</button>
              ))}
            </div>
            {selected === 'all' && profiles.length > 1 ? (
              <select aria-label="Which account" value={account} onChange={(e) => setPicked(e.target.value)} className="glass-field h-11 rounded-full px-4 text-[13px] font-bold">
                {profiles.map((p) => <option key={p.id} value={p.id}>@{p.username}</option>)}
              </select>
            ) : (
              <span className="inline-flex items-center gap-1.5 h-11 px-4 rounded-full glass-field text-[13px] font-bold"><PenLine className="w-3.5 h-3.5" /> @{current?.username}</span>
            )}
            {kit && !kit.saved && <span className="text-[12.5px] font-semibold text-amber-300">No brand kit yet for this account. Set one up in the Brand kit tab.</span>}
          </div>

          {!kit || !drafts ? (
            <div className="h-72 rounded-[30px] glass-panel animate-pulse" />
          ) : tab === 'caption' ? (
            <CaptionLab key={`${account}:${kit.saved}:${JSON.stringify(kit.products.map((p) => p.id))}`} account={account} kit={kit} drafts={drafts.drafts} posts={posts} reload={reloadDrafts} />
          ) : tab === 'briefs' ? (
            <BriefBuilder key={account} account={account} kit={kit} drafts={drafts.drafts} posts={posts} reload={reloadDrafts} />
          ) : (
            <BrandKitEditor key={account} account={account} accountName={current?.username ?? ''} kit={kit} reload={reloadKit} />
          )}
        </>
      )}
    </div>
  );
}
