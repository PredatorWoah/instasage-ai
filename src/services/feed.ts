import { prisma } from '@/lib/prisma';
import type { AccountScope } from '@/lib/scope';
import type { CompetitorPost } from '@/services/competitors';
import type { PostAnalysis } from '@/services/ai';

// "Live from Sage" on the Overview: what happened lately, assembled from real data (no AI call)

export type FeedItem = {
  id: string;
  kind: 'review' | 'action' | 'rival' | 'post' | 'sync' | 'goal';
  at: number; // ms, for sorting
  ago: string;
  text: string; // may hold [[post:ID|label]] links
  href?: string;
};

const DAY = 86_400_000;
const label = (caption: string, max = 42) => {
  const s = caption.replace(/\s+/g, ' ').trim();
  return (s.length > max ? `${s.slice(0, max - 1)}…` : s) || 'Untitled';
};
// Labels go inside [[post:ID|label]], so they must not close the link early
const linkLabel = (caption: string) => label(caption).replace(/[[\]|]/g, '');

export function ago(ms: number, now = Date.now()) {
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export async function sageFeed(userId: string, scope: AccountScope): Promise<FeedItem[]> {
  const now = Date.now();
  const since = new Date(now - 14 * DAY);
  const [posts, actions, rivals] = await Promise.all([
    prisma.post.findMany({
      where: { socialProfileId: { in: scope.profileIds }, publishedAt: { gte: since } },
      orderBy: { publishedAt: 'desc' },
      take: 20,
      select: { id: true, caption: true, type: true, views: true, publishedAt: true, platform: true },
    }),
    prisma.sageAction.findMany({ where: { userId, createdAt: { gte: since }, undoneAt: null }, orderBy: { createdAt: 'desc' }, take: 6 }),
    scope.mode === 'youtube' ? Promise.resolve([]) : prisma.competitor.findMany({ where: { userId }, select: { username: true, posts: true } }),
  ]);

  const reviews = posts.length
    ? await prisma.aiResult.findMany({ where: { userId, kind: { in: posts.map((p) => `post:${p.id}`) } }, select: { kind: true, content: true, createdAt: true } })
    : [];
  const byId = new Map(posts.map((p) => [p.id, p]));
  const items: FeedItem[] = [];

  for (const r of reviews) {
    const post = byId.get(r.kind.slice(5));
    const a = r.content as Partial<PostAnalysis>;
    if (!post || !a.verdict) continue;
    const at = r.createdAt.getTime();
    items.push({ id: `review:${post.id}`, kind: 'review', at, ago: ago(at, now), text: `Reviewed [[post:${post.id}|${linkLabel(post.caption)}]]: ${a.verdict}${a.bestFor ? ` Good for ${String(a.bestFor).toLowerCase()}.` : ''}` });
  }

  for (const a of actions) {
    const at = a.createdAt.getTime();
    items.push({ id: `action:${a.id}`, kind: 'action', at, ago: ago(at, now), text: `You asked, I changed it: ${a.summary}.` });
  }

  // New posts in their first two days, while the numbers are still moving
  for (const p of posts.filter((x) => now - x.publishedAt.getTime() < 2 * DAY)) {
    const at = p.publishedAt.getTime();
    const noun = p.platform === 'youtube' ? (p.type === 'short' ? 'Short' : 'video') : p.type;
    items.push({ id: `post:${p.id}`, kind: 'post', at, ago: ago(at, now), text: `Your ${noun} [[post:${p.id}|${linkLabel(p.caption)}]] went up: ${p.views.toLocaleString('en-US')} views so far, still collecting.` });
  }

  for (const c of rivals) {
    const list = (Array.isArray(c.posts) ? c.posts : []) as CompetitorPost[];
    const fresh = list.filter((p) => now - Date.parse(p.timestamp) < 3 * DAY).slice(0, 1);
    for (const p of fresh) {
      const at = Date.parse(p.timestamp);
      items.push({
        id: `rival:${c.username}:${p.id}`, kind: 'rival', at, ago: ago(at, now),
        text: `@${c.username} posted a ${p.type.toLowerCase()}${p.likes != null ? `: ${p.likes.toLocaleString('en-US')} likes` : ''}, ${p.comments} comments so far. "${label(p.caption, 60)}"`,
        href: '/competitors',
      });
    }
  }

  const synced = scope.profiles.map((p) => p.lastSyncedAt.getTime());
  if (synced.length) {
    const at = Math.max(...synced);
    items.push({ id: 'sync', kind: 'sync', at, ago: ago(at, now), text: `Synced ${scope.profiles.length === 1 ? `@${scope.profiles[0].username}` : `${scope.profiles.length} accounts`}. Next automatic sync tonight at 1:00 AM UTC.` });
  }

  return items.sort((a, b) => b.at - a.at).slice(0, 7);
}
