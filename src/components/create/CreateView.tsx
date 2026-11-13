'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PenLine } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { usePlatform } from '@/lib/usePlatform';
import { cn } from '@/lib/utils';
import { BrandKitEditor } from './BrandKitEditor';
import { BriefBuilder } from './BriefBuilder';
import { HookLibrary } from './HookLibrary';
import { Scorecard } from './Scorecard';
import { Studio } from './Studio';
import type { Draft, Kit, PostRow } from './ui';
import { AiPicker } from '@/components/ai-assistant/AiPicker';

const TABS = [
  { id: 'caption', label: 'Write' },
  { id: 'briefs', label: 'Briefs' },
  { id: 'hooks', label: 'Hooks' },
  { id: 'score', label: 'Scorecard' },
  { id: 'kit', label: 'Brand kit' },
] as const;
type Tab = (typeof TABS)[number]['id'];

// Create: write captions and briefs to each account's own brand kit
export function CreateView() {
  const { profiles, selected, loaded } = usePlatform();
  // Deep links: /create?topic=... from an idea, /create?from=<post id> from a post page
  const params = useSearchParams();
  const initialTopic = (params.get('topic') ?? '').slice(0, 300);
  const fromPost = params.get('from') ?? '';
  const [tab, setTab] = useState<Tab>(() => TABS.find((t) => t.id === params.get('tab'))?.id ?? 'caption');
  const [picked, setPicked] = useState<string | null>(null);
  // The post to build on: from the link, or picked in the hook library
  const [usePost, setUsePost] = useState<string | null>(null);

  // With one account in the top switcher, that is the account. With "all", choose here.
  const { data: allPosts } = useCachedJson<(PostRow & { username?: string })[]>(profiles.length ? '/api/posts' : null);
  // A link from a post page opens that post's own account
  const linked = profiles.find((p) => p.username === allPosts?.find((x) => x.id === fromPost)?.username)?.id;
  const account = selected !== 'all' ? selected : profiles.find((p) => p.id === picked)?.id ?? linked ?? profiles[0]?.id ?? null;
  const current = profiles.find((p) => p.id === account);

  const id = account ? encodeURIComponent(account) : null;
  const { data: kit, error: kitError, reload: reloadKit } = useLoad<Kit>(id ? `/api/brand-kit?account=${id}` : null);
  const { data: drafts, error: draftsError, reload: reloadDrafts } = useLoad<{ drafts: Draft[] }>(id ? `/api/creative?account=${id}` : null);
  const loadError = kitError ?? draftsError;
  const posts = (allPosts ?? []).filter((p) => !current || p.username === current.username);
  const wanted = usePost ?? fromPost;
  const sourcePost = posts.some((p) => p.id === wanted) ? wanted : '';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h1 className="font-display font-extrabold text-[40px] sm:text-[60px] leading-[0.92] tracking-[-0.05em]">Create.</h1>
        <p className="text-[15px] text-muted-foreground max-w-[640px]">Captions and briefs written to each account&apos;s own rules. Sage drafts from the hooks and words that work for you, forecasts how each draft will do, and gets marked on it afterwards.</p>
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
            <AiPicker group="writer" />
            {kit && !kit.saved && <span className="text-[12.5px] font-semibold text-amber-400">No brand kit yet for this account. Set one up in the Brand kit tab.</span>}
          </div>

          {loadError ? (
            <div role="alert" className="glass-panel rounded-[30px] p-6 flex flex-col gap-3 items-start">
              <p className="font-display font-extrabold text-[22px] tracking-[-0.03em]">This did not load.</p>
              <p className="text-[14px] text-muted-foreground break-words">{loadError}</p>
              <button type="button" onClick={() => { reloadKit(); reloadDrafts(); }} className="h-11 px-5 rounded-full bg-foreground text-background text-[13px] font-bold">Try again</button>
            </div>
          ) : !kit || !drafts ? (
            <div className="h-72 rounded-[30px] glass-panel animate-pulse" aria-label="Loading" />
          ) : (
            <>
              {/* Write stays mounted while other tabs are open, so an unsaved draft survives a look at Hooks or the Scorecard */}
              <div hidden={tab !== 'caption'}>
                <Studio key={`${account}:${kit.saved}:${JSON.stringify(kit.products.map((p) => p.id))}`} account={account} kit={kit} drafts={drafts.drafts} posts={posts} reload={reloadDrafts} initialTopic={initialTopic} sourcePost={sourcePost} setSourcePost={setUsePost} />
              </div>
              {tab === 'briefs' && <BriefBuilder key={account} account={account} kit={kit} drafts={drafts.drafts} posts={posts} reload={reloadDrafts} />}
              {tab === 'hooks' && <HookLibrary key={account} account={account} onUse={(postId) => { setUsePost(postId); setTab('caption'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
              {tab === 'score' && <Scorecard key={account} account={account} />}
              {tab === 'kit' && <BrandKitEditor key={account} account={account} accountName={current?.username ?? ''} kit={kit} reload={reloadKit} others={profiles.filter((p) => p.id !== account).map((p) => ({ id: p.id, username: p.username }))} />}
            </>
          )}
        </>
      )}
    </div>
  );
}

// Loads JSON and keeps the reason when it fails, so the page can say what went wrong
function useLoad<T>(url: string | null) {
  const [state, setState] = useState<{ url: string | null; data: T | null; error: string | null }>({ url, data: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const timer = setTimeout(() => !cancelled && setState((s) => (s.url === url && s.data ? s : { url, data: null, error: 'This is taking too long. Check your connection and try again.' })), 20_000);
    fetch(url)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && body) setState({ url, data: body as T, error: null });
        else setState({ url, data: null, error: body?.error || (res.status === 401 ? 'You are signed out. Sign in again.' : `The server answered ${res.status}.`) });
      })
      .catch(() => !cancelled && setState({ url, data: null, error: 'Could not reach the server. Check your connection.' }))
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  const current = state.url === url ? state : { data: null, error: null };
  return { data: current.data, error: current.error, reload };
}
