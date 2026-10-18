'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Copy, Link2, PenLine, Plus, Search, Trash2, Unlink } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { Modal } from '@/components/ui/modal';
import { AiNotice } from '@/components/ai-assistant/AiNotice';
import { formatLabel } from '@/lib/platform';
import { formatNumber, formatRelativeTime } from '@/utils/formatters';
import { Markdown } from './Markdown';
import { SAVED_URL, reloadSaved, type SavedIdea } from './saveIdea';
import type { Post } from '@/types';
import { cn } from '@/lib/utils';

const COLUMNS: { id: SavedIdea['status']; title: string; hint: string; dot: string }[] = [
  { id: 'idea', title: 'Ideas', hint: 'Worth making', dot: 'bg-[#FFE066]' },
  { id: 'planned', title: 'Planned', hint: 'Scripted or scheduled', dot: 'bg-[#4CC9F0]' },
  { id: 'posted', title: 'Posted', hint: 'Out in the world', dot: 'bg-[#4ADE9E]' },
];
const SOURCE: Record<SavedIdea['source'], string> = { manual: 'You', plan: 'Game plan', brainstorm: 'Brainstorm', recommendation: 'Quick win' };

export function IdeaBoard() {
  const { data, refresh } = useCachedJson<SavedIdea[]>(SAVED_URL);
  const [ideas, setIdeas] = useState<SavedIdea[] | null>(null);
  const [title, setTitle] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [linking, setLinking] = useState<SavedIdea | null>(null);
  const [writing, setWriting] = useState<SavedIdea | null>(null);
  const list = ideas ?? data ?? [];

  const reload = async () => {
    setIdeas(null);
    await refresh();
    reloadSaved();
  };

  const patch = async (idea: SavedIdea, body: Record<string, unknown>) => {
    setIdeas(list.map((i) => (i.id === idea.id ? { ...i, ...body } as SavedIdea : i)));
    await fetch(`${SAVED_URL}/${idea.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if ('postId' in body) await reload();
    else reloadSaved();
  };

  const move = (idea: SavedIdea, status: SavedIdea['status']) => {
    patch(idea, { status });
    // Just posted: ask which real post it became, so its results can be tracked
    if (status === 'posted' && !idea.postId) setLinking({ ...idea, status });
  };

  const remove = async (id: string) => {
    setIdeas(list.filter((i) => i.id !== id));
    await fetch(`${SAVED_URL}/${id}`, { method: 'DELETE' });
    reloadSaved();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch(SAVED_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, source: 'manual' }) });
    setTitle('');
    reload();
  };

  if (data === undefined) return <div className="h-72 rounded-[30px] bg-card animate-pulse" />;

  const tracked = list.filter((i) => i.result);
  const winners = tracked.filter((i) => i.result!.viewsLift >= 0).length;

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Jot down an idea before it escapes..."
          className="flex-1 h-12 rounded-full bg-card border border-white/[0.07] px-5 text-sm outline-none focus:border-white/[0.2]"
        />
        <button type="submit" disabled={!title.trim()} className="h-12 px-5 rounded-full bg-white text-background text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      {tracked.length > 0 && (
        <p className="text-[13px] text-muted-foreground">
          <b className="text-foreground">{winners} of {tracked.length}</b> ideas you posted beat your average views. The Game plan and Brainstorm now learn from these results.
        </p>
      )}

      {list.length === 0 && (
        <p className="text-sm text-muted-foreground p-4 rounded-2xl border border-dashed border-white/[0.1]">
          Nothing here yet. Save posts from your game plan, replies from a brainstorm, or add your own above.
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {COLUMNS.map((col, ci) => {
          const items = list.filter((i) => i.status === col.id);
          return (
            <div key={col.id} className="rounded-[30px] bg-card border border-white/[0.05] p-3 flex flex-col gap-2 min-h-[200px]">
              <div className="flex items-center justify-between px-2 pt-1 pb-2">
                <p className="text-sm font-bold flex items-center gap-2"><span className={cn('w-2.5 h-2.5 rounded-full', col.dot)} /> {col.title}</p>
                <span className="text-[11px] text-muted-foreground">{items.length} · {col.hint}</span>
              </div>
              {items.map((idea) => (
                <div key={idea.id} className="rounded-2xl p-3 bg-white/[0.03] border border-white/[0.06]">
                  <button onClick={() => setOpenId(openId === idea.id ? null : idea.id)} className="text-left w-full">
                    <p className="text-[13px] font-semibold leading-snug">{idea.title}</p>
                  </button>
                  {openId === idea.id && idea.notes && (
                    <div className="mt-2 pt-2 border-t border-white/[0.06] text-muted-foreground [&_p]:text-[13px] [&_li]:text-[13px]">
                      <Markdown text={idea.notes} />
                    </div>
                  )}

                  {idea.post && (
                    <Link href={`/content/${encodeURIComponent(idea.post.id)}`} className="mt-2 flex items-center gap-2 rounded-xl p-1.5 bg-white/[0.04] hover:bg-white/[0.07]">
                      <span className="relative w-9 h-9 rounded-lg overflow-hidden bg-[linear-gradient(160deg,#8C7BFF,#FF6F91)] shrink-0">
                        {idea.post.thumbnail && <Image src={idea.post.thumbnail} alt="" fill unoptimized sizes="36px" className="object-cover" />}
                      </span>
                      <span className="min-w-0 text-[11px] leading-snug">
                        <b>{formatNumber(idea.post.views)} views</b>
                        {idea.result && (
                          <span className={cn('ml-1.5 font-bold', idea.result.viewsLift >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                            {idea.result.viewsLift >= 0 ? '+' : ''}{idea.result.viewsLift}% vs avg
                          </span>
                        )}
                        <span className="block text-muted-foreground">{idea.post.performanceScore.toFixed(1)}% eng · {formatRelativeTime(idea.post.publishedAt)}</span>
                      </span>
                    </Link>
                  )}
                  {idea.status === 'posted' && !idea.post && (
                    <button onClick={() => setLinking(idea)} className="mt-2 w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-xl border border-dashed border-emerald-400/30 text-[12px] font-bold text-emerald-300 hover:bg-emerald-500/10">
                      <Link2 className="w-3.5 h-3.5" /> Link the real post to see how it did
                    </button>
                  )}
                  {idea.drafts && Object.keys(idea.drafts).length > 0 && (
                    <p className="mt-2 text-[11px] text-indigo-300">Drafts ready: {Object.keys(idea.drafts).map((k) => (k === 'script' ? 'script' : k === 'carousel' ? 'carousel' : 'caption')).join(', ')}</p>
                  )}

                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-muted-foreground">{SOURCE[idea.source] ?? 'You'}</span>
                    {idea.format && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-muted-foreground capitalize">{idea.format}</span>}
                    <span className="ml-auto flex items-center">
                      <button onClick={() => setWriting(idea)} className="p-1.5 rounded-full text-muted-foreground hover:text-indigo-300 hover:bg-white/[0.08]" aria-label="Write it for me" title="Write it for me">
                        <PenLine className="w-3.5 h-3.5" />
                      </button>
                      {idea.post && (
                        <button onClick={() => patch(idea, { postId: null })} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/[0.08]" aria-label="Unlink post" title="Unlink post">
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {ci > 0 && (
                        <button onClick={() => move(idea, COLUMNS[ci - 1].id)} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/[0.08]" aria-label={`Move to ${COLUMNS[ci - 1].title}`}>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {ci < COLUMNS.length - 1 && (
                        <button onClick={() => move(idea, COLUMNS[ci + 1].id)} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/[0.08]" aria-label={`Move to ${COLUMNS[ci + 1].title}`}>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => remove(idea.id)} className="p-1.5 rounded-full text-muted-foreground hover:text-rose-400 hover:bg-white/[0.08]" aria-label="Delete idea">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {linking && <LinkPostModal idea={linking} onClose={() => setLinking(null)} onPick={(postId) => { patch(linking, { postId }); setLinking(null); toast.success('Linked', { description: 'Its results now show on the card and feed your next Game plan.' }); }} />}
      {writing && <WriteModal idea={writing} onClose={() => { setWriting(null); reload(); }} />}
    </div>
  );
}

// Words that say little about what a post is about
const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'you', 'this', 'that', 'from', 'what', 'how', 'why', 'are', 'our', 'into', 'about', 'post', 'reel', 'video']);
const words = (s: string) => new Set(s.toLowerCase().replace(/#[\w]+/g, ' ').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.has(w)));

function LinkPostModal({ idea, onClose, onPick }: { idea: SavedIdea; onClose: () => void; onPick: (postId: string) => void }) {
  const { data } = useCachedJson<Post[]>('/api/posts');
  const [query, setQuery] = useState('');

  // Best guesses first: words shared with the idea, and posted after the idea was saved
  const ranked = useMemo(() => {
    const ideaWords = words(`${idea.title} ${idea.notes}`);
    const savedAt = new Date(idea.createdAt).getTime();
    return [...(data ?? [])]
      .map((p) => {
        const overlap = [...words(p.caption)].filter((w) => ideaWords.has(w)).length;
        const after = new Date(p.publishedAt).getTime() >= savedAt - 86_400_000 ? 1 : 0;
        return { post: p, score: overlap * 2 + after };
      })
      .sort((a, b) => b.score - a.score || new Date(b.post.publishedAt).getTime() - new Date(a.post.publishedAt).getTime());
  }, [data, idea]);

  const q = query.trim().toLowerCase();
  const shown = ranked.filter((r) => !q || r.post.caption.toLowerCase().includes(q)).slice(0, 40);

  return (
    <Modal open onClose={onClose} title="Which post did this idea become?" subtitle={<>&ldquo;{idea.title}&rdquo;</>}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search captions..." autoFocus className="w-full h-10 rounded-full bg-white/[0.05] border border-white/[0.08] pl-9 pr-4 text-sm outline-none focus:border-white/[0.2]" />
      </div>
      {data === undefined ? (
        <div className="h-40 rounded-2xl bg-white/[0.03] animate-pulse" />
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts match. Sync first if you just posted it.</p>
      ) : (
        <ul className="max-h-[50vh] overflow-y-auto space-y-1.5">
          {shown.map(({ post, score }, i) => (
            <li key={post.id}>
              <button onClick={() => onPick(post.id)} className="w-full flex items-center gap-3 p-2 rounded-2xl text-left hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08]">
                <span className="relative w-12 h-12 rounded-xl overflow-hidden bg-[linear-gradient(160deg,#8C7BFF,#FF6F91)] shrink-0">
                  {post.thumbnail && <Image src={post.thumbnail} alt="" fill unoptimized sizes="48px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold truncate">{post.caption || 'No caption'}</span>
                  <span className="block text-[11px] text-muted-foreground">{formatLabel(post.type)} · {formatRelativeTime(post.publishedAt)} · {formatNumber(post.views)} views</span>
                </span>
                {i === 0 && score > 1 && !q && <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Best match</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

const DRAFT_TABS = [
  { id: 'script', label: 'Reel script' },
  { id: 'carousel', label: 'Carousel' },
  { id: 'caption', label: 'Caption' },
] as const;

function WriteModal({ idea, onClose }: { idea: SavedIdea; onClose: () => void }) {
  const [tab, setTab] = useState<(typeof DRAFT_TABS)[number]['id']>('script');
  const [drafts, setDrafts] = useState<Partial<Record<string, string>>>(idea.drafts ?? {});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ error: string; code?: string } | null>(null);

  const write = async () => {
    setBusy(true);
    setFailure(null);
    const res = await fetch(`${SAVED_URL}/${idea.id}/write`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: tab }) });
    const data = await res.json().catch(() => ({ error: 'The AI took too long. Try again.' }));
    setBusy(false);
    if (!res.ok) return setFailure(data);
    setDrafts((d) => ({ ...d, [tab]: data.text }));
  };

  const copy = async () => {
    await navigator.clipboard.writeText(drafts[tab] ?? '').catch(() => {});
    toast.success('Copied');
  };

  const text = drafts[tab];
  return (
    <Modal open onClose={onClose} wide title="Write it for me" subtitle={<>&ldquo;{idea.title}&rdquo;, in your voice, using what already works for you</>}>
      <div className="flex gap-1 p-1 rounded-full bg-white/[0.05] border border-white/[0.06] w-full sm:w-auto sm:inline-flex">
        {DRAFT_TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setFailure(null); }} className={cn('flex-1 sm:flex-none h-9 px-4 rounded-full text-[13px] font-bold transition-colors', tab === t.id ? 'bg-white text-background' : 'text-muted-foreground hover:text-foreground')}>
            {t.label}{drafts[t.id] ? ' ✓' : ''}
          </button>
        ))}
      </div>
      {failure && <AiNotice code={failure.code} message={failure.error} />}
      {busy ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 text-sm text-muted-foreground animate-pulse">Writing your {DRAFT_TABS.find((t) => t.id === tab)?.label.toLowerCase()}...</div>
      ) : text ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 max-h-[50vh] overflow-y-auto"><Markdown text={text} /></div>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing written yet. It reads your creator profile and your numbers first, so it sounds like you.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button onClick={write} disabled={busy} className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white text-background text-sm font-bold disabled:opacity-60">
          <PenLine className="w-4 h-4" /> {text ? 'Rewrite' : 'Write it'}
        </button>
        {text && (
          <button onClick={copy} className="inline-flex items-center gap-2 h-11 px-4 rounded-full bg-white/[0.07] border border-white/[0.1] text-sm font-bold">
            <Copy className="w-4 h-4" /> Copy
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">Drafts are saved on the idea. Fill in your <Link href="/account#creator-profile" className="text-indigo-400 hover:underline">creator profile</Link> for better results.</p>
    </Modal>
  );
}
