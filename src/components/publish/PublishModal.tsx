'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, CircleAlert, ExternalLink, ImagePlus, Link2, Loader2, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { refreshJson, useCachedJson } from '@/lib/useCachedJson';
import { usePlatform } from '@/lib/usePlatform';
import { atTime, nowMs } from '@/lib/calendar';
import { parseHashtags } from '@/lib/brandKit';
import { cn } from '@/lib/utils';
import type { PostKind, PostView } from '@/services/publish';
import { btn, input, area } from '@/components/create/ui';
import { MAX_VIDEO_BYTES, prepareImage, uploadFile } from './media';

export const QUEUE_URL = '/api/publish';
export type Queue = { posts: PostView[]; uploads: boolean; cronSecret: boolean; lastTick: { at: string; source: string } | null; allowed: boolean };

const KINDS: { id: PostKind; label: string; hint: string }[] = [
  { id: 'image', label: 'Photo', hint: 'One photo' },
  { id: 'carousel', label: 'Carousel', hint: '2 to 10 photos or videos' },
  { id: 'reel', label: 'Reel', hint: 'One video, MP4 or MOV' },
  { id: 'story', label: 'Story', hint: 'One photo or video, no caption' },
];

type Item = { key: string; name: string; type: 'image' | 'video'; preview: string | null; progress: number; url: string | null; stored: boolean; error: string | null; note: string | null };

const localInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const STEP: Record<string, string> = {
  scheduled: 'Sending to Instagram…',
  processing: 'Instagram is preparing it. Videos can take a few minutes; you can close this and it carries on.',
};

// Pick the files, check the caption, post now or at a time. Then it follows the post until it is live.
export function PublishModal({ onClose, account: initialAccount, caption: initialCaption = '', when: initialWhen = null, ideaId, draftId, kind: initialKind = 'image', title }: {
  onClose: () => void;
  account?: string;
  caption?: string;
  when?: Date | null;
  ideaId?: string;
  draftId?: string | null;
  kind?: PostKind;
  title?: string;
}) {
  const { profiles } = usePlatform();
  const accounts = profiles.filter((p) => p.platform === 'instagram');
  const { data: queue } = useCachedJson<Queue | null>(QUEUE_URL);
  const [account, setAccount] = useState(initialAccount ?? '');
  const accountId = accounts.some((a) => a.id === account) ? account : accounts[0]?.id ?? '';
  const [kind, setKind] = useState<PostKind>(initialKind);
  const [items, setItems] = useState<Item[]>([]);
  const [caption, setCaption] = useState(initialCaption);
  const [mode, setMode] = useState<'now' | 'later'>(initialWhen && initialWhen.getTime() > nowMs() ? 'later' : 'now');
  const [when, setWhen] = useState(() => localInput(initialWhen && initialWhen.getTime() > nowMs() ? initialWhen : atTime(new Date(nowMs() + 86_400_000), null)));
  const [link, setLink] = useState('');
  const [linkType, setLinkType] = useState<'image' | 'video'>('image');
  const [sending, setSending] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [post, setPost] = useState<PostView | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Follow a post that is on its way until it is live or fails
  useEffect(() => {
    if (!post || (post.status !== 'processing' && !(post.status === 'scheduled' && !post.scheduledFor))) return;
    const timer = setTimeout(async () => {
      const res = await fetch(`${QUEUE_URL}/${post.id}`).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { post?: PostView } | null;
      if (alive.current && body?.post) setPost(body.post);
      if (body?.post && (body.post.status === 'published' || body.post.status === 'failed')) {
        refreshJson(QUEUE_URL);
        refreshJson('/api/ideas/saved');
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [post]);

  const allowedTypes = kind === 'reel' ? 'video/mp4,video/quicktime' : kind === 'image' ? 'image/*' : 'image/*,video/mp4,video/quicktime';
  const max = kind === 'carousel' ? 10 : 1;
  const ready = items.filter((i) => i.url && !i.error);
  const uploading = items.some((i) => !i.url && !i.error);
  const videos = ready.filter((i) => i.type === 'video').length;
  const countOk = kind === 'carousel' ? ready.length >= 2 && ready.length <= 10 : ready.length === 1 && (kind !== 'reel' || videos === 1) && (kind !== 'image' || videos === 0);
  const tags = parseHashtags(caption).length;
  const at = mode === 'later' && when ? new Date(when) : null;
  const timeBad = mode === 'later' && (!at || Number.isNaN(at.getTime()) || at.getTime() < nowMs() + 60_000);
  const captionBad = kind !== 'story' && (caption.length > 2200 || tags > 30);
  const canSend = !!accountId && countOk && !uploading && !timeBad && !captionBad && !sending;

  const update = (key: string, patch: Partial<Item>) => alive.current && setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = max - items.length;
    const picked = [...files].slice(0, Math.max(0, room));
    for (const file of picked) {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov)$/i.test(file.name);
      const key = `${file.name}:${file.size}:${Math.random().toString(36).slice(2)}`;
      const item: Item = { key, name: file.name, type: isVideo ? 'video' : 'image', preview: null, progress: 0, url: null, stored: true, error: null, note: null };
      setItems((list) => [...list, item]);
      try {
        if (isVideo) {
          if (kind === 'image') throw new Error('A photo post takes a photo. Pick Reel or Carousel for a video.');
          const limit = kind === 'story' ? MAX_VIDEO_BYTES.story : MAX_VIDEO_BYTES.other;
          if (file.size > limit) throw new Error(`Too big: Instagram takes up to ${Math.round(limit / 1024 / 1024)} MB here.`);
          if (!/^video\/(mp4|quicktime)$/.test(file.type) && !/\.(mp4|mov)$/i.test(file.name)) throw new Error('Instagram takes MP4 or MOV videos.');
          update(key, { preview: URL.createObjectURL(file) });
          const url = await uploadFile(file.type ? file : new Blob([file], { type: 'video/mp4' }), file.name, /\.mov$/i.test(file.name) ? 'mov' : 'mp4', (p) => update(key, { progress: p }));
          update(key, { url, progress: 100 });
        } else {
          if (kind === 'reel') throw new Error('A reel takes a video.');
          const { blob, cropped } = await prepareImage(file, kind);
          update(key, { preview: URL.createObjectURL(blob), note: cropped ? 'Trimmed to a shape Instagram accepts' : null });
          const url = await uploadFile(blob, file.name, 'jpg', (p) => update(key, { progress: p }));
          update(key, { url, progress: 100 });
        }
      } catch (error) {
        update(key, { error: (error as Error).message || 'The upload failed. Try again.' });
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const addLink = () => {
    const url = link.trim();
    if (!/^https:\/\/\S+$/.test(url) || items.length >= max) return;
    setItems((list) => [...list, { key: url + Math.random(), name: url.split('/').pop() || 'link', type: linkType, preview: linkType === 'image' ? url : null, progress: 100, url, stored: false, error: null, note: null }]);
    setLink('');
  };

  const send = async () => {
    setSending(true);
    setProblems([]);
    try {
      const res = await fetch(QUEUE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: accountId, kind, caption, media: ready.map((i) => ({ url: i.url, type: i.type, stored: i.stored })), scheduledFor: at ? at.toISOString() : null, ideaId, draftId }),
      });
      const body = (await res.json().catch(() => ({}))) as { post?: PostView; error?: string; problems?: string[] };
      if (!res.ok || !body.post) setProblems(body.problems ?? [body.error || 'It did not go through. Try again.']);
      else {
        setPost(body.post);
        refreshJson(QUEUE_URL);
        refreshJson('/api/ideas/saved');
      }
    } catch {
      setProblems(['Could not reach the server. Check your connection and try again.']);
    }
    setSending(false);
  };

  const heading = post ? (post.status === 'published' ? 'It is live' : post.status === 'failed' ? 'It did not go out' : post.scheduledFor ? 'Scheduled' : 'Posting…') : title ?? 'Post to Instagram';
  const accountName = accounts.find((a) => a.id === accountId)?.username;

  return (
    <Modal open onClose={onClose} title={heading} subtitle={accountName && !heading.includes(`@${accountName}`) ? `@${accountName}` : undefined} wide>
      {post ? (
        <Result post={post} onClose={onClose} />
      ) : accounts.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">Connect an Instagram account first, on the Accounts page.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {queue && !queue.allowed && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-[13px] leading-snug flex flex-col gap-2">
              <span>InstaSage may not be allowed to post yet. If posting fails with a permission message, allow it once: Instagram asks you to log in and tick <b>publish content</b>.</span>
              <a href="/api/connect/instagram?publish=1" className={`${btn.small} self-start`}>Allow posting</a>
            </div>
          )}

          {accounts.length > 1 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold">Account</span>
              <select value={accountId} onChange={(e) => setAccount(e.target.value)} className={input}>
                {accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}
              </select>
            </label>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold">What is it?</span>
            <div role="radiogroup" aria-label="Post type" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {KINDS.map((k) => (
                <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} disabled={items.length > 0} onClick={() => setKind(k.id)} className={cn('rounded-2xl px-3 py-2.5 text-left border transition-colors disabled:cursor-not-allowed', kind === k.id ? 'bg-foreground text-background border-foreground' : 'glass-field hover:bg-ink/[0.1] disabled:opacity-50')}>
                  <span className="block text-[13.5px] font-bold">{k.label}</span>
                  <span className={cn('block text-[11.5px] leading-snug', kind === k.id ? 'opacity-75' : 'text-muted-foreground')}>{k.hint}</span>
                </button>
              ))}
            </div>
            {items.length > 0 && <span className="text-[12px] text-muted-foreground">Remove the files to change the type.</span>}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold">{kind === 'carousel' ? `Files (${items.length} of 10, in this order)` : 'File'}</span>
            {items.length > 0 && (
              <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {items.map((i, n) => (
                  <li key={i.key} className="relative rounded-xl overflow-hidden glass-field aspect-[4/5] min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of a file not uploaded yet */}
                    {i.preview && i.type === 'image' && <img src={i.preview} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                    {i.preview && i.type === 'video' && <video src={i.preview} muted playsInline className="absolute inset-0 w-full h-full object-cover" />}
                    {!i.preview && <span className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground p-2 text-center break-all">{i.name}</span>}
                    {kind === 'carousel' && <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/70 text-white text-[11px] font-bold flex items-center justify-center">{n + 1}</span>}
                    <button type="button" onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))} aria-label={`Remove ${i.name}`} className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                    {!i.url && !i.error && (
                      <span className="absolute inset-x-0 bottom-0 p-1.5 bg-black/70 text-white text-[11px] font-bold flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> {i.progress}%</span>
                    )}
                    {i.error && <span role="alert" className="absolute inset-x-0 bottom-0 p-1.5 bg-rose-600/90 text-white text-[10.5px] leading-snug">{i.error}</span>}
                    {i.note && i.url && <span className="absolute inset-x-0 bottom-0 p-1.5 bg-black/70 text-white text-[10.5px] leading-snug">{i.note}</span>}
                  </li>
                ))}
              </ul>
            )}
            {items.length < max && (
              queue?.uploads === false ? (
                <p className="text-[12.5px] text-amber-400 leading-snug">Uploading from this device needs Vercel Blob turned on (Settings, Posting, has the steps). Until then, paste a public https link to the file below.</p>
              ) : (
                <>
                  <input ref={fileRef} type="file" accept={allowedTypes} multiple={kind === 'carousel'} onChange={(e) => addFiles(e.target.files)} className="sr-only" id="publish-files" />
                  <label htmlFor="publish-files" className={cn(btn.ghost, 'cursor-pointer self-start')}><ImagePlus className="w-4 h-4" /> {items.length ? 'Add more' : kind === 'reel' ? 'Choose the video' : kind === 'image' ? 'Choose the photo' : 'Choose files'}</label>
                </>
              )
            )}
            {items.length < max && (
              <details className="text-[12.5px]" open={queue?.uploads === false}>
                <summary className="cursor-pointer text-muted-foreground font-semibold">Or use a link to the file</summary>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <select aria-label="File type" value={linkType} onChange={(e) => setLinkType(e.target.value as 'image' | 'video')} className={`${input} sm:w-32 h-11`}>
                    <option value="image">Photo</option>
                    <option value="video">Video</option>
                  </select>
                  <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://… (a direct link to a JPEG or MP4)" className={`${input} h-11`} />
                  <button type="button" onClick={addLink} disabled={!/^https:\/\/\S+$/.test(link.trim())} className={`${btn.small} h-11 shrink-0`}><Link2 className="w-3.5 h-3.5 mr-1.5" /> Add</button>
                </div>
                <p className="text-muted-foreground mt-1.5 leading-snug">Instagram downloads it itself, so it must open without a login. Google Drive and Dropbox share pages do not work; the direct file link does.</p>
              </details>
            )}
          </div>

          {kind === 'story' ? (
            <p className="text-[12.5px] text-muted-foreground">Stories go out without a caption: Instagram does not take one through its posting API. Add text on the image itself.</p>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold">Caption</span>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className={`${area} min-h-[140px]`} placeholder="Write it here, or open this from Write in Create to bring your caption over." />
              <span className={cn('text-[12px]', captionBad ? 'text-rose-400 font-semibold' : 'text-muted-foreground')}>{caption.length} / 2,200 characters · {tags} / 30 hashtags</span>
            </label>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold">When</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="When to post">
              {([['now', 'Post now'], ['later', 'Schedule']] as const).map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)} className={cn('h-11 px-5 rounded-full text-[13px] font-bold transition-colors', mode === id ? 'bg-foreground text-background' : 'glass-field hover:bg-ink/[0.12]')}>{label}</button>
              ))}
            </div>
            {mode === 'later' && (
              <>
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Date and time" className={`${input} sm:max-w-xs`} />
                {timeBad && <span className="text-[12px] text-amber-400 font-semibold">Pick a time at least a minute from now.</span>}
                {queue && !recentTick(queue) && <span className="text-[12px] text-muted-foreground leading-snug">The 5 minute scheduler has not checked in yet, so this goes out when you next open InstaSage or at the morning sync, whichever comes first. Set it up in Settings, Posting, to post on time.</span>}
              </>
            )}
          </div>

          {problems.length > 0 && (
            <ul role="alert" className="rounded-2xl bg-rose-500/10 border border-rose-500/25 p-3.5 flex flex-col gap-1.5">
              {problems.map((p) => <li key={p} className="text-[13px] text-rose-400 font-semibold flex gap-2"><CircleAlert className="w-4 h-4 shrink-0 mt-0.5" />{p}</li>)}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={send} disabled={!canSend} className={btn.primary}>{sending ? 'Sending…' : mode === 'now' ? 'Post now' : 'Schedule it'}</button>
            <button type="button" onClick={onClose} className={btn.ghost}>Cancel</button>
            {!countOk && !uploading && <span className="text-[12px] text-muted-foreground">{kind === 'carousel' ? 'Add 2 to 10 files.' : kind === 'reel' ? 'Add one video.' : kind === 'image' ? 'Add one photo.' : 'Add one photo or video.'}</span>}
            {uploading && <span className="text-[12px] text-muted-foreground">Uploading…</span>}
          </div>
          <p className="text-[12px] text-muted-foreground leading-snug">Your brand kit&apos;s flagged claims are checked before it goes out, and again at the scheduled time. Once a post is live, edit or delete it in the Instagram app.</p>
        </div>
      )}
    </Modal>
  );
}

export const recentTick = (q: Queue) => !!q.lastTick && q.lastTick.source === 'pinger' && nowMs() - Date.parse(q.lastTick.at) < 20 * 60_000;

function Result({ post, onClose }: { post: PostView; onClose: () => void }) {
  const moving = post.status === 'processing' || (post.status === 'scheduled' && !post.scheduledFor);
  return (
    <div className="flex flex-col gap-4">
      {post.status === 'published' ? (
        <p className="flex items-start gap-2.5 text-[15px] font-semibold text-emerald-400"><CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> Posted.</p>
      ) : post.status === 'failed' ? (
        <div role="alert" className="flex flex-col gap-3">
          <p className="flex items-start gap-2.5 text-[14px] font-semibold text-rose-400 break-words"><CircleAlert className="w-5 h-5 shrink-0 mt-0.5" /> {post.error ?? 'Instagram did not accept it.'}</p>
          {post.code === 'needs_publish_permission' && <a href="/api/connect/instagram?publish=1" className={`${btn.primary} self-start`}>Allow posting</a>}
          <p className="text-[12.5px] text-muted-foreground">It stays in the queue on the Calendar tab, where you can retry it.</p>
        </div>
      ) : post.scheduledFor ? (
        <p className="text-[15px] leading-snug">Goes out on <b>{new Date(post.scheduledFor).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</b>. It is on the calendar, and you get a notification when it is live.</p>
      ) : null}
      {moving && <p className="flex items-start gap-2.5 text-[14px] leading-snug"><Loader2 className="w-5 h-5 shrink-0 animate-spin text-indigo-400" /> {STEP[post.status] ?? 'Working…'}</p>}
      <div className="flex flex-wrap gap-2">
        {post.permalink && <a href={post.permalink} target="_blank" rel="noopener noreferrer" className={btn.primary}>Open on Instagram <ExternalLink className="w-4 h-4" /></a>}
        {post.status === 'published' && !post.permalink && <span className="text-[13px] text-muted-foreground">Live on your profile. The link shows up here after the next sync.</span>}
        <Link href="/create?tab=calendar" onClick={onClose} className={btn.ghost}>See the queue</Link>
        <button type="button" onClick={onClose} className={btn.ghost}>Close</button>
      </div>
    </div>
  );
}
