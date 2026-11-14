import { del } from '@vercel/blob';
import type { ScheduledPost } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { flaggedHits, parseHashtags } from '@/lib/brandKit';
import { getKit } from '@/services/creative';
import {
  COMMENTS_SCOPE,
  createMediaContainer,
  EXTRA_SCOPES,
  IgPermissionError,
  mediaContainerStatus,
  mediaPermalink,
  publishMediaContainer,
  PUBLISH_SCOPE,
} from '@/services/instagram';
import { sendPush } from '@/services/push';

// Posting to Instagram, now or at a planned time. Each post moves one step at a time:
//   scheduled -> processing (Instagram fetches and prepares the media) -> published, or failed.
// Steps run from the 5 minute pinger, the daily cron, the app opening, and the page polling a post
// it just sent, so a post never depends on one of them alone. A lock keeps two of them off the same post.

export type PostKind = 'image' | 'carousel' | 'reel' | 'story';
export type MediaItem = { url: string; type: 'image' | 'video'; stored?: boolean };
export const POST_KINDS: PostKind[] = ['image', 'carousel', 'reel', 'story'];
export const PERMISSION_CODE = 'needs_publish_permission';
export const PERMISSION_ERROR = 'InstaSage is not allowed to post yet. Allow posting once, then retry.';

const LOCK_MS = 2 * 60_000;
const PROCESSING_LIMIT_MS = 30 * 60_000; // Instagram gives up on a container after a while; so do we
const MAX_ATTEMPTS = 3;

// ---------- Which extra Instagram permissions this user has allowed ----------

const scopesKey = (userId: string) => `igscopes:${userId}`;

export async function grantedExtras(userId: string): Promise<string[]> {
  const row = await prisma.appConfig.findUnique({ where: { key: scopesKey(userId) } });
  try {
    const list = row ? (JSON.parse(row.value) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && EXTRA_SCOPES.includes(x)) : [];
  } catch {
    return [];
  }
}

// Instagram usually says which permissions were ticked; when it does not, keep what was there plus what was asked for
export async function saveGrantedExtras(userId: string, permissions: string[] | null, asked: string[]) {
  const before = await grantedExtras(userId);
  const next = permissions ? EXTRA_SCOPES.filter((s) => permissions.includes(s)) : [...new Set([...before, ...asked])];
  const value = JSON.stringify(next);
  await prisma.appConfig.upsert({ where: { key: scopesKey(userId) }, create: { key: scopesKey(userId), value }, update: { value } });
}

export const canPost = async (userId: string) => (await grantedExtras(userId)).includes(PUBLISH_SCOPE);
export const canComment = async (userId: string) => (await grantedExtras(userId)).includes(COMMENTS_SCOPE);

// ---------- Checks before anything is sent ----------

const isHttps = (u: unknown): u is string => {
  if (typeof u !== 'string' || u.length > 2000) return false;
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};

// Only files this app uploaded (Vercel Blob, under posts/) are ever deleted, whatever the browser says
const ownUpload = (u: string) => {
  const url = new URL(u);
  return url.hostname.endsWith('.public.blob.vercel-storage.com') && url.pathname.startsWith('/posts/');
};

export function readMedia(raw: unknown): MediaItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 10).flatMap((m) => {
    const x = m as Partial<MediaItem> | null;
    if (!x || !isHttps(x.url) || (x.type !== 'image' && x.type !== 'video')) return [];
    return [{ url: x.url, type: x.type, stored: x.stored === true && ownUpload(x.url) }];
  });
}

// Instagram's own rules for each kind, plus the brand kit's flagged claims. Returns what is wrong, if anything.
export async function checkPost(userId: string, accountId: string, kind: PostKind, caption: string, media: MediaItem[]) {
  const problems: string[] = [];
  const videos = media.filter((m) => m.type === 'video').length;
  if (kind === 'image' && (media.length !== 1 || videos)) problems.push('A photo post needs exactly one photo.');
  if (kind === 'reel' && (media.length !== 1 || !videos)) problems.push('A reel needs exactly one video.');
  if (kind === 'story' && media.length !== 1) problems.push('A story needs exactly one photo or video.');
  if (kind === 'carousel' && (media.length < 2 || media.length > 10)) problems.push('A carousel needs 2 to 10 photos or videos.');
  if (kind !== 'story') {
    if (caption.length > 2200) problems.push(`The caption is ${caption.length} characters; Instagram allows 2,200.`);
    const tags = parseHashtags(caption).length;
    if (tags > 30) problems.push(`${tags} hashtags; Instagram allows 30.`);
    const mentions = (caption.match(/(^|\s)@[\w.]+/g) ?? []).length;
    if (mentions > 20) problems.push(`${mentions} @mentions; Instagram allows 20.`);
    const kit = await getKit(userId, accountId);
    const hits = flaggedHits(kit, caption);
    if (hits.length) problems.push(`Flagged in your brand kit: ${hits.join(', ')}. Soften or remove ${hits.length === 1 ? 'it' : 'them'} first.`);
  }
  return problems;
}

// ---------- One step at a time ----------

const tokenFor = async (post: ScheduledPost) => {
  const profile = await prisma.socialProfile.findFirst({ where: { id: post.socialProfileId, userId: post.userId }, select: { accessToken: true, externalId: true, username: true } });
  if (!profile?.accessToken || !profile.externalId) throw new Error('This Instagram account is disconnected. Reconnect it on the Accounts page, then retry.');
  return { token: profile.accessToken, igUserId: profile.externalId, username: profile.username };
};

// Only one runner works on a post at a time
async function claim(post: ScheduledPost) {
  const { count } = await prisma.scheduledPost.updateMany({
    where: { id: post.id, status: post.status, OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - LOCK_MS) } }] },
    data: { lockedAt: new Date() },
  });
  return count === 1;
}

const save = (id: string, data: Parameters<typeof prisma.scheduledPost.update>[0]['data']) => prisma.scheduledPost.update({ where: { id }, data: { ...data, lockedAt: null } });

const itemParams = (m: MediaItem, kind: PostKind, caption: string): Record<string, string> => {
  const media: Record<string, string> = m.type === 'video' ? { video_url: m.url } : { image_url: m.url };
  if (kind === 'story') return { media_type: 'STORIES', ...media };
  if (kind === 'reel') return { media_type: 'REELS', ...media, caption, share_to_feed: 'true' };
  if (kind === 'carousel') return { ...(m.type === 'video' ? { media_type: 'VIDEO' } : {}), ...media, is_carousel_item: 'true' };
  return { ...media, caption };
};

type Children = { id: string; type: 'image' | 'video' }[];

// Moves the post one step on. Safe to call any time: it does nothing when there is nothing to do.
export async function advance(post: ScheduledPost): Promise<ScheduledPost> {
  const due = post.status === 'scheduled' && (!post.scheduledFor || post.scheduledFor.getTime() <= Date.now());
  if (!due && post.status !== 'processing') return post;
  if (!(await claim(post))) return post;
  try {
    const { token, igUserId, username } = await tokenFor(post);
    const media = readMedia(post.media);
    const kind = post.kind as PostKind;

    if (post.status === 'scheduled') {
      // Checked again right before sending: the brand kit may have changed since it was planned
      const problems = await checkPost(post.userId, post.socialProfileId, kind, post.caption, media);
      if (problems.length) return save(post.id, { status: 'failed', error: problems.join(' ') });
      if (kind === 'carousel') {
        const children: Children = [];
        for (const m of media) children.push({ id: await createMediaContainer(token, igUserId, itemParams(m, kind, post.caption)), type: m.type });
        return save(post.id, { status: 'processing', children, containerId: null, error: null, attempts: { increment: 1 }, startedAt: new Date() });
      }
      const containerId = await createMediaContainer(token, igUserId, itemParams(media[0], kind, post.caption));
      return save(post.id, { status: 'processing', containerId, error: null, attempts: { increment: 1 }, startedAt: new Date() });
    }

    // processing
    if (post.startedAt && Date.now() - post.startedAt.getTime() > PROCESSING_LIMIT_MS) {
      return save(post.id, { status: 'failed', error: 'Instagram took more than 30 minutes to prepare the media. Retry, or try a shorter or smaller video.' });
    }
    if (kind === 'carousel' && !post.containerId) {
      const children = (post.children as Children | null) ?? [];
      const states = await Promise.all(children.map((c) => mediaContainerStatus(token, c.id)));
      const broken = states.find((s) => s.code === 'ERROR' || s.code === 'EXPIRED');
      if (broken) return save(post.id, { status: 'failed', error: `Instagram could not use one of the files${broken.detail ? `: ${broken.detail}` : ''}. Check its format and size, then retry.` });
      if (states.some((s) => s.code !== 'FINISHED')) return save(post.id, {});
      const containerId = await createMediaContainer(token, igUserId, { media_type: 'CAROUSEL', children: children.map((c) => c.id).join(','), caption: post.caption });
      return save(post.id, { containerId });
    }
    if (!post.containerId) return save(post.id, { status: 'scheduled' });

    const state = await mediaContainerStatus(token, post.containerId);
    if (state.code === 'IN_PROGRESS') return save(post.id, {});
    if (state.code === 'ERROR' || state.code === 'EXPIRED') {
      return save(post.id, { status: 'failed', error: state.code === 'EXPIRED' ? 'Instagram dropped the prepared post before it went out. Retry.' : `Instagram could not use the media${state.detail ? `: ${state.detail}` : ''}. Check its format, size and shape, then retry.` });
    }
    // FINISHED (or PUBLISHED by an earlier run that stopped right after)
    const mediaId = state.code === 'PUBLISHED' ? null : await publishMediaContainer(token, igUserId, post.containerId);
    const permalink = mediaId ? await mediaPermalink(token, mediaId) : null;
    const done = await save(post.id, { status: 'published', mediaId, permalink, publishedAt: new Date(), error: null });
    await afterPublish(done, username).catch((error) => console.error('After publishing:', error));
    return done;
  } catch (error) {
    const permission = error instanceof IgPermissionError;
    const message = permission ? PERMISSION_ERROR : (error as Error).message || 'Instagram did not answer.';
    // A hiccup is tried again on the next run: while sending, up to three times; while Instagram prepares
    // the media, until the 30 minute limit. A missing permission is never retried on its own.
    if (!permission && post.status === 'processing') return save(post.id, { error: message });
    const retry = !permission && post.attempts + 1 < MAX_ATTEMPTS;
    console.warn(`Posting ${post.id} failed${retry ? ', will retry' : ''}:`, message);
    return save(post.id, retry ? { attempts: { increment: 1 }, error: message } : { status: 'failed', error: message, attempts: { increment: 1 } });
  }
}

async function afterPublish(post: ScheduledPost, username: string) {
  if (post.ideaId) await prisma.savedIdea.updateMany({ where: { id: post.ideaId, userId: post.userId }, data: { status: 'posted' } });
  // Instagram keeps its own copy, so the uploaded files can go
  await removeStored(readMedia(post.media));
  const first = post.caption.split('\n')[0].trim().slice(0, 80);
  await sendPush(post.userId, { title: `Posted to @${username}`, body: first || 'Your post is live.', url: post.permalink ?? '/create?tab=calendar', tag: `posted:${post.id}` }).catch(() => {});
}

export async function removeStored(media: MediaItem[]) {
  const urls = media.filter((m) => m.stored).map((m) => m.url);
  if (urls.length && process.env.BLOB_READ_WRITE_TOKEN) await del(urls).catch((error) => console.warn('Removing uploaded files failed:', (error as Error).message));
}

// ---------- The queue ----------

const tickKey = 'publish:lastTick';

export async function lastTick(): Promise<{ at: string; source: string } | null> {
  const row = await prisma.appConfig.findUnique({ where: { key: tickKey } });
  try {
    return row ? JSON.parse(row.value) : null;
  } catch {
    return null;
  }
}

// Everything that is due or processing, oldest first, within the time given. userId narrows it to one person.
export async function runQueue(source: 'pinger' | 'cron' | 'app', budgetMs = 45_000, userId?: string) {
  const started = Date.now();
  if (source !== 'app') {
    const value = JSON.stringify({ at: new Date().toISOString(), source });
    await prisma.appConfig.upsert({ where: { key: tickKey }, create: { key: tickKey, value }, update: { value } }).catch(() => {});
  }
  const posts = await prisma.scheduledPost.findMany({
    where: { ...(userId ? { userId } : {}), OR: [{ status: 'processing' }, { status: 'scheduled', OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }] }] },
    orderBy: { scheduledFor: 'asc' },
    take: 20,
  });
  const out = { checked: 0, published: 0, failed: 0 };
  for (const p of posts) {
    if (Date.now() - started > budgetMs) break;
    let cur = await advance(p);
    // An image is usually ready at once: carry it straight through to published in this run
    for (let i = 0; i < 3 && cur.status === 'processing' && Date.now() - started < budgetMs; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      cur = await advance(cur);
    }
    out.checked++;
    if (cur.status === 'published') out.published++;
    if (cur.status === 'failed') out.failed++;
  }
  return out;
}

// After a sync: posts published from here are now real Post rows, so tie them to their draft and
// calendar entry. That lets the Scorecard grade the forecast with no linking by hand.
export async function linkPublished(profileId: string) {
  const posts = await prisma.scheduledPost.findMany({ where: { socialProfileId: profileId, status: 'published', mediaId: { not: null }, OR: [{ ideaId: { not: null } }, { draftId: { not: null } }] }, orderBy: { publishedAt: 'desc' }, take: 50 });
  if (!posts.length) return;
  const existing = new Set((await prisma.post.findMany({ where: { id: { in: posts.map((p) => p.mediaId!) } }, select: { id: true } })).map((p) => p.id));
  for (const p of posts) {
    if (!existing.has(p.mediaId!)) continue;
    if (p.ideaId) await prisma.savedIdea.updateMany({ where: { id: p.ideaId, userId: p.userId, postId: null }, data: { postId: p.mediaId, status: 'posted' } });
    if (p.draftId) await prisma.creativeDraft.updateMany({ where: { id: p.draftId, userId: p.userId, postId: null }, data: { postId: p.mediaId } });
  }
}

// What the page needs, never the token
export const postView = (p: ScheduledPost) => ({
  id: p.id,
  accountId: p.socialProfileId,
  kind: p.kind,
  caption: p.caption,
  media: readMedia(p.media).map((m) => ({ url: m.url, type: m.type })),
  scheduledFor: p.scheduledFor?.toISOString() ?? null,
  status: p.status,
  permalink: p.permalink,
  error: p.error,
  code: p.error === PERMISSION_ERROR ? PERMISSION_CODE : null,
  ideaId: p.ideaId,
  publishedAt: p.publishedAt?.toISOString() ?? null,
  createdAt: p.createdAt.toISOString(),
});
export type PostView = ReturnType<typeof postView>;
