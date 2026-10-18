'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Heart, MessageCircle, RefreshCw, Send, Sparkles, ShieldCheck } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { AiNotice } from '@/components/ai-assistant/AiNotice';
import { formatLabel } from '@/lib/platform';
import { formatRelativeTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { CommentRow } from '@/services/comments';

type PostItem = { id: string; caption: string; thumbnail: string; type: string; comments: number; publishedAt: string; username: string };
type Load = { comments?: CommentRow[]; error?: string; code?: string };

const PERMISSION_CODE = 'needs_comment_permission';

// Read and answer Instagram comments, with AI drafts in your voice
export function CommentsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data } = useCachedJson<{ posts: PostItem[] }>('/api/comments');
  const posts = data?.posts ?? [];
  const selected = params.get('post') ?? posts.find((p) => p.comments > 0)?.id ?? posts[0]?.id ?? null;

  useEffect(() => {
    const connected = params.get('connected');
    const error = params.get('error');
    if (connected) toast.success('Comment replies are on', { description: `@${connected} can now be answered from here.` });
    if (error) toast.error('Instagram did not allow it', { description: error });
    if (connected || error) router.replace(pathname);
  }, [params, router, pathname]);

  const choose = (id: string) => router.replace(`${pathname}?post=${encodeURIComponent(id)}`, { scroll: false });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">Comments</h1>
        <p className="text-[15px] text-muted-foreground mt-3">Answer people from one place, with AI drafts in your voice. You always choose what gets posted.</p>
      </div>

      {data === undefined ? (
        <div className="h-96 rounded-[30px] bg-card animate-pulse" />
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4 rounded-xl border border-dashed border-border">No Instagram posts from the last 60 days in the selected accounts. Comments work for Instagram only.</p>
      ) : (
        <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start">
          <aside className="rounded-[30px] bg-card border border-ink/[0.05] p-2 lg:sticky lg:top-24 max-h-[40vh] lg:max-h-[75vh] overflow-y-auto">
            {posts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => choose(p.id)}
                aria-current={p.id === selected ? 'true' : undefined}
                className={cn('w-full flex items-center gap-3 p-2 rounded-2xl text-left', p.id === selected ? 'bg-ink/[0.08]' : 'hover:bg-ink/[0.04]')}
              >
                <span className="on-color relative w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-[linear-gradient(160deg,#8C7BFF,#FF6F91)]">
                  {p.thumbnail && <Image src={p.thumbnail} alt="" fill unoptimized sizes="44px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold truncate">{p.caption || 'No caption'}</span>
                  <span className="block text-[11px] text-muted-foreground">{formatLabel(p.type)} · {formatRelativeTime(p.publishedAt)}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-muted-foreground shrink-0"><MessageCircle className="w-3.5 h-3.5" />{p.comments}</span>
              </button>
            ))}
          </aside>
          {selected && <PostComments key={selected} postId={selected} post={posts.find((p) => p.id === selected)} />}
        </div>
      )}
    </div>
  );
}

function PostComments({ postId, post }: { postId: string; post?: PostItem }) {
  const url = `/api/comments?postId=${encodeURIComponent(postId)}`;
  const [load, setLoad] = useState<Load | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [drafting, setDrafting] = useState(false);
  const [aiError, setAiError] = useState<{ error: string; code?: string } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({ error: 'Unexpected response' })) }))
      .then(({ body }) => !cancelled && setLoad(body))
      .catch(() => !cancelled && setLoad({ error: 'Could not reach the server.' }));
    return () => {
      cancelled = true;
    };
  }, [url, nonce]);

  const reload = () => setNonce((n) => n + 1);

  if (!load) return <div className="h-80 rounded-[30px] bg-card animate-pulse" />;
  if (load.code === PERMISSION_CODE) return <PermissionCard username={post?.username} />;
  if (load.error) return <p className="text-sm text-amber-400 bg-amber-500/5 border border-amber-500/15 rounded-2xl px-4 py-3">{load.error}</p>;

  const all = load.comments ?? [];
  const open = all.filter((c) => !c.answered && !c.hidden);
  const shown = filter === 'open' ? open : all;

  const draftAll = async () => {
    const targets = shown.filter((c) => !suggestions[c.id] && c.text.trim()).slice(0, 15);
    if (!targets.length) return toast('Every comment here already has drafts');
    setDrafting(true);
    setAiError(null);
    const res = await fetch('/api/comments/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, comments: targets.map((c) => ({ id: c.id, username: c.username, text: c.text })) }) });
    const body = await res.json().catch(() => ({ error: 'Unexpected response' }));
    if (res.ok) setSuggestions((s) => ({ ...s, ...body.suggestions }));
    else setAiError(body);
    setDrafting(false);
  };

  return (
    <section className="rounded-[30px] bg-card border border-ink/[0.05] p-4 sm:p-6 space-y-4 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 rounded-full bg-ink/[0.05] border border-ink/[0.06] mr-auto" role="tablist" aria-label="Which comments">
          {([['open', `Unanswered (${open.length})`], ['all', `All (${all.length})`]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={cn('h-8 px-3 rounded-full text-[12px] font-bold', filter === id ? 'bg-ink text-background' : 'text-muted-foreground hover:text-foreground')}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={reload} aria-label="Refresh comments" className="p-2 rounded-full hover:bg-ink/[0.06]"><RefreshCw className="w-4 h-4" /></button>
        <button type="button" onClick={draftAll} disabled={drafting || !shown.length} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full prism-hero text-white text-[12px] font-bold disabled:opacity-60">
          <Sparkles className={cn('w-3.5 h-3.5', drafting && 'animate-pulse')} /> {drafting ? 'Drafting...' : 'Draft replies'}
        </button>
      </div>
      {aiError && <AiNotice code={aiError.code} message={aiError.error} />}

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{filter === 'open' ? 'All caught up on this post.' : 'No comments on this post yet.'}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((c) => <CommentCard key={c.id} postId={postId} comment={c} suggestions={suggestions[c.id]} onDone={reload} />)}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">Instagram shares the latest 50 comments per post through its API. Replies post publicly from your account.</p>
    </section>
  );
}

function CommentCard({ postId, comment, suggestions, onDone }: { postId: string; comment: CommentRow; suggestions?: string[]; onDone: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'reply' | 'hide' | null>(null);

  const reply = async () => {
    setBusy('reply');
    const res = await fetch('/api/comments/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, commentId: comment.id, message: text }) });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error('Reply not posted', { description: body.error });
    toast.success(`Replied to @${comment.username}`);
    setText('');
    onDone();
  };

  const hide = async () => {
    setBusy('hide');
    const res = await fetch('/api/comments/hide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, commentId: comment.id, hide: !comment.hidden }) });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error('Could not change that', { description: body.error });
    toast.success(comment.hidden ? 'Comment visible again' : 'Comment hidden', { description: comment.hidden ? undefined : 'Only you and its author can see it now.' });
    onDone();
  };

  return (
    <li className={cn('rounded-2xl border p-3 sm:p-4 space-y-2.5', comment.answered ? 'border-ink/[0.05] bg-ink/[0.015]' : 'border-ink/[0.08] bg-ink/[0.03]', comment.hidden && 'opacity-60')}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px]"><a href={`https://www.instagram.com/${comment.username}/`} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">@{comment.username}</a> <span className="text-muted-foreground text-[11px]">· {formatRelativeTime(comment.at)}{comment.likes ? ` · ` : ''}</span>{comment.likes > 0 && <span className="text-muted-foreground text-[11px] inline-flex items-center gap-0.5"><Heart className="w-3 h-3" />{comment.likes}</span>}{comment.hidden && <span className="text-[11px] text-amber-400"> · hidden</span>}</p>
          <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{comment.text}</p>
        </div>
        <button type="button" onClick={hide} disabled={!!busy} aria-label={comment.hidden ? 'Show comment' : 'Hide comment'} title={comment.hidden ? 'Show comment' : 'Hide comment'} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-ink/[0.06] shrink-0">
          {comment.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>

      {comment.replies.length > 0 && (
        <ul className="pl-3 border-l-2 border-ink/[0.08] space-y-1">
          {comment.replies.map((r) => (
            <li key={r.id} className="text-[12px]"><span className={cn('font-bold', r.mine && 'text-indigo-300')}>@{r.username}{r.mine ? ' (you)' : ''}</span> <span className="text-muted-foreground">{r.text}</span></li>
          ))}
        </ul>
      )}

      {suggestions && suggestions.length === 0 && <p className="text-[12px] text-muted-foreground">The AI thinks this one is spam or abuse, so it skipped it. Hiding it is an option.</p>}
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {suggestions.map((s, i) => (
            <button key={i} type="button" onClick={() => setText(s)} className={cn('text-left text-[13px] px-3 py-2 rounded-xl border transition-colors', text === s ? 'bg-indigo-500/15 border-indigo-400/40' : 'bg-ink/[0.03] border-ink/[0.07] hover:bg-ink/[0.07]')}>{s}</button>
          ))}
        </div>
      )}

      {!comment.hidden && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void reply();
          }}
          className="flex gap-2 items-end"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={text.length > 80 ? 3 : 1}
            maxLength={2200}
            placeholder={`Reply to @${comment.username}`}
            aria-label={`Reply to @${comment.username}`}
            className="flex-1 min-h-[40px] rounded-xl border border-border bg-background/60 px-3 py-2 text-sm resize-y focus:outline-none focus:border-indigo-500"
          />
          <button type="submit" disabled={!text.trim() || !!busy} className="h-10 px-4 inline-flex items-center gap-1.5 rounded-xl bg-ink text-background text-sm font-bold disabled:opacity-50 shrink-0">
            <Send className="w-4 h-4" /> {busy === 'reply' ? 'Posting' : 'Reply'}
          </button>
        </form>
      )}
    </li>
  );
}

function PermissionCard({ username }: { username?: string }) {
  return (
    <section className="rounded-[30px] bg-card border border-ink/[0.05] p-6 sm:p-8 space-y-4">
      <span className="w-12 h-12 rounded-2xl prism-hero flex items-center justify-center"><ShieldCheck className="w-6 h-6 text-white" /></span>
      <h2 className="text-xl font-bold">One more permission</h2>
      <p className="text-sm text-muted-foreground max-w-xl">
        Reading and answering comments needs Instagram&apos;s <code className="text-[12px]">instagram_business_manage_comments</code> permission, which InstaSage didn&apos;t ask for when you first connected{username ? ` @${username}` : ''}. Log in once more and tick it. Nothing else changes.
      </p>
      <a href="/api/connect/instagram?comments=1" className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-ink text-background text-sm font-bold">Allow comment replies</a>
      <p className="text-[12px] text-muted-foreground max-w-xl">If Instagram says the permission is invalid: in your Meta app open Instagram → API setup with Instagram login, and make sure <b>instagram_business_manage_comments</b> is in the permissions list. While the app is in Development mode, it works for you and your testers without App Review.</p>
    </section>
  );
}
