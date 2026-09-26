import { prisma } from '@/lib/prisma';

// Rival Instagram accounts through Meta's Business Discovery API. It only works with a
// Facebook Login token for an Instagram professional account that is linked to a Facebook
// Page, so this is a second, separate connection from the Instagram Login one.

const GRAPH = 'https://graph.facebook.com/v23.0';
export const META_STATE_COOKIE = 'meta_oauth_state';
const SCOPES = ['instagram_basic', 'instagram_manage_insights', 'pages_show_list', 'pages_read_engagement', 'business_management'];

export function metaOAuthConfig() {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  // Business-type Meta apps use a Facebook Login for Business configuration instead of scopes
  const configId = process.env.FACEBOOK_LOGIN_CONFIG_ID?.trim() || null;
  return appId && appSecret ? { appId, appSecret, configId } : null;
}

export const metaCallbackUrl = (req: Request) => `${new URL(req.url).origin}/api/connect/facebook/callback`;

export function metaAuthorizeUrl(redirectUri: string, state: string) {
  const config = metaOAuthConfig()!;
  const url = new URL('https://www.facebook.com/v23.0/dialog/oauth');
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  if (config.configId) url.searchParams.set('config_id', config.configId);
  else url.searchParams.set('scope', SCOPES.join(','));
  return url.toString();
}

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number } };

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: 'no-store' });
  const body = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || body.error) {
    const e = body.error;
    if (e?.code === 190) throw new Error('Your Facebook connection expired. Reconnect with Facebook on the Competitors page.');
    if (e?.code === 110 || e?.error_subcode === 2207013) throw new Error('not_business');
    throw new Error(e?.message || `Facebook request failed (${res.status})`);
  }
  return body;
}

// Code -> short-lived user token -> long-lived (about 60 days) -> the Page's linked Instagram account
export async function connectMeta(userId: string, code: string, redirectUri: string) {
  const config = metaOAuthConfig();
  if (!config) throw new Error('Facebook Login is not set up. Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in Vercel.');

  const short = await graph<{ access_token: string }>('/oauth/access_token', {
    client_id: config.appId, client_secret: config.appSecret, redirect_uri: redirectUri, code,
  });
  const long = await graph<{ access_token: string; expires_in?: number }>('/oauth/access_token', {
    grant_type: 'fb_exchange_token', client_id: config.appId, client_secret: config.appSecret, fb_exchange_token: short.access_token,
  });
  const token = long.access_token;

  const pages = await graph<{ data: { name: string; instagram_business_account?: { id: string; username?: string } }[] }>('/me/accounts', {
    fields: 'name,instagram_business_account{id,username}', limit: '100', access_token: token,
  });
  const linked = pages.data.filter((p) => p.instagram_business_account);
  if (!linked.length) {
    throw new Error('None of your Facebook Pages has an Instagram professional account linked. Link one (Page settings → Linked accounts → Instagram), then connect again, and tick that Page when Facebook asks.');
  }
  // Prefer a Page whose Instagram account is already connected in InstaSage
  const mine = new Set((await prisma.socialProfile.findMany({ where: { userId, platform: 'instagram' }, select: { username: true } })).map((p) => p.username));
  const page = linked.find((p) => mine.has(p.instagram_business_account!.username ?? '')) ?? linked[0];
  const ig = page.instagram_business_account!;

  const data = {
    accessToken: token,
    expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
    igUserId: ig.id,
    igUsername: ig.username ?? '',
    pageName: page.name,
  };
  return prisma.metaLink.upsert({ where: { userId }, update: data, create: { ...data, userId } });
}

// ---------- Looking up a competitor ----------

type DiscoveryMedia = {
  id: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  permalink?: string;
  timestamp: string;
};
type Discovery = {
  business_discovery: {
    username: string;
    name?: string;
    biography?: string;
    profile_picture_url?: string;
    followers_count?: number;
    media_count?: number;
    media?: { data: DiscoveryMedia[] };
  };
};

export type CompetitorPost = {
  id: string;
  caption: string;
  likes: number | null;
  comments: number;
  type: string;
  permalink: string | null;
  image: string | null;
  timestamp: string;
  engagement: number | null;
};

export type CompetitorStats = {
  engagement: number | null; // (avg likes + avg comments) / followers, per post
  avgLikes: number | null;
  avgComments: number;
  postsPerWeek: number;
  formatMix: { type: string; share: number; avgEngagement: number | null }[];
  topHashtags: string[];
  bestDay: string | null;
  likesHidden: boolean;
};

const typeOf = (m: DiscoveryMedia) =>
  m.media_product_type === 'REELS' ? 'reel' : m.media_type === 'CAROUSEL_ALBUM' ? 'carousel' : m.media_type === 'VIDEO' ? 'video' : 'post';

// Posts per week, format mix and averages from the last 30 posts
export function competitorStats(followers: number, posts: CompetitorPost[]): CompetitorStats {
  const withLikes = posts.filter((p) => p.likes != null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const eng = (p: CompetitorPost) => (followers ? (((p.likes ?? 0) + p.comments) / followers) * 100 : null);

  const newest = posts[0] ? new Date(posts[0].timestamp).getTime() : Date.now();
  const recent = posts.filter((p) => newest - new Date(p.timestamp).getTime() <= 28 * 86400_000);

  const types = new Map<string, CompetitorPost[]>();
  for (const p of posts) types.set(p.type, [...(types.get(p.type) ?? []), p]);

  const tags = new Map<string, number>();
  for (const p of posts) for (const t of p.caption.match(/#[\p{L}\p{N}_]+/gu) ?? []) tags.set(t.toLowerCase(), (tags.get(t.toLowerCase()) ?? 0) + 1);

  const days = new Map<string, number[]>();
  for (const p of withLikes) {
    const day = new Date(p.timestamp).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    days.set(day, [...(days.get(day) ?? []), eng(p) ?? 0]);
  }
  const bestDay = [...days].filter(([, v]) => v.length >= 2).sort((a, b) => avg(b[1]) - avg(a[1]))[0]?.[0] ?? null;

  const round = (n: number, dp = 2) => Number(n.toFixed(dp));
  return {
    engagement: withLikes.length && followers ? round(avg(withLikes.map((p) => eng(p)!))) : null,
    avgLikes: withLikes.length ? Math.round(avg(withLikes.map((p) => p.likes!))) : null,
    avgComments: Math.round(avg(posts.map((p) => p.comments))),
    postsPerWeek: round(recent.length / 4, 1),
    formatMix: [...types].map(([type, rows]) => ({
      type,
      share: Math.round((rows.length / posts.length) * 100),
      avgEngagement: rows.some((r) => r.likes != null) && followers ? round(avg(rows.filter((r) => r.likes != null).map((r) => eng(r)!))) : null,
    })).sort((a, b) => b.share - a.share),
    topHashtags: [...tags].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t),
    bestDay,
    likesHidden: posts.length > 0 && withLikes.length === 0,
  };
}

async function lookup(link: { accessToken: string; igUserId: string }, username: string) {
  const fields = `business_discovery.username(${username}){username,name,biography,profile_picture_url,followers_count,media_count,media.limit(30){id,caption,like_count,comments_count,media_type,media_product_type,media_url,permalink,timestamp}}`;
  try {
    return (await graph<Discovery>(`/${link.igUserId}`, { fields, access_token: link.accessToken })).business_discovery;
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'not_business' || /cannot find|does not exist|Invalid user id/i.test(message)) {
      throw new Error(`@${username} was not found, or is a personal account. Instagram only shares numbers for Business and Creator accounts.`);
    }
    throw error;
  }
}

export const cleanUsername = (raw: string) =>
  raw.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '').toLowerCase();

export async function refreshCompetitor(userId: string, rawUsername: string) {
  const link = await prisma.metaLink.findUnique({ where: { userId } });
  if (!link) throw new Error('Connect with Facebook first.');
  const username = cleanUsername(rawUsername);
  if (!/^[a-z0-9._]{1,30}$/.test(username)) throw new Error('That is not a valid Instagram username.');

  try {
    const d = await lookup(link, username);
    const followers = d.followers_count ?? 0;
    const posts: CompetitorPost[] = (d.media?.data ?? []).map((m) => {
      const likes = m.like_count ?? null;
      return {
        id: m.id,
        caption: (m.caption ?? '').slice(0, 400),
        likes,
        comments: m.comments_count ?? 0,
        type: typeOf(m),
        permalink: m.permalink ?? null,
        // Video files are not images; only photos and carousels get a preview
        image: m.media_type === 'VIDEO' ? null : m.media_url ?? null,
        timestamp: m.timestamp,
        engagement: likes != null && followers ? Number((((likes + (m.comments_count ?? 0)) / followers) * 100).toFixed(2)) : null,
      };
    });
    const data = {
      name: d.name ?? null,
      biography: d.biography ?? null,
      profilePictureUrl: d.profile_picture_url ?? null,
      followers,
      mediaCount: d.media_count ?? 0,
      stats: competitorStats(followers, posts) as object,
      posts: posts as object[],
      error: null,
      lastSyncedAt: new Date(),
    };
    return prisma.competitor.upsert({ where: { userId_username: { userId, username } }, update: data, create: { ...data, userId, username } });
  } catch (error) {
    // Keep an existing row (and its last good numbers) but remember why the refresh failed
    await prisma.competitor.updateMany({ where: { userId, username }, data: { error: (error as Error).message } });
    throw error;
  }
}

// Your own numbers measured the same way (likes and comments per follower), for a fair comparison
export async function ownBenchmark(userId: string) {
  const profiles = await prisma.socialProfile.findMany({ where: { userId, platform: 'instagram' } });
  const results = [];
  for (const p of profiles) {
    const rows = await prisma.post.findMany({ where: { socialProfileId: p.id }, orderBy: { publishedAt: 'desc' }, take: 30 });
    const posts: CompetitorPost[] = rows.map((r) => ({
      id: r.id, caption: r.caption, likes: r.likes, comments: r.comments, type: r.type, permalink: r.permalink,
      image: r.thumbnail || null, timestamp: r.publishedAt.toISOString(),
      engagement: p.followerCount ? Number((((r.likes + r.comments) / p.followerCount) * 100).toFixed(2)) : null,
    }));
    results.push({ username: p.username, name: p.displayName, profilePictureUrl: p.profilePictureUrl, followers: p.followerCount, mediaCount: rows.length, stats: competitorStats(p.followerCount, posts) });
  }
  return results;
}

// Compact text for the AI
export async function competitorsToPrompt(userId: string) {
  const rivals = await prisma.competitor.findMany({ where: { userId, error: null }, orderBy: { followers: 'desc' }, take: 8 });
  if (!rivals.length) return '';
  const lines = rivals.map((c) => {
    const s = c.stats as CompetitorStats | null;
    const top = ((c.posts as CompetitorPost[] | null) ?? []).filter((p) => p.likes != null).sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 2)
      .map((p) => `"${p.caption.replace(/\s+/g, ' ').slice(0, 90)}" (${p.type}, ${p.likes} likes)`).join('; ');
    return `@${c.username}: ${c.followers} followers, ${s?.postsPerWeek ?? '?'} posts/week, ${s?.engagement ?? '?'}% engagement per follower, mix ${s?.formatMix.map((f) => `${f.type} ${f.share}%`).join(' ') ?? '?'}${top ? `, top posts: ${top}` : ''}`;
  });
  return `\n## Competitors (public numbers from Instagram Business Discovery; engagement here = likes + comments per follower)\n${lines.join('\n')}`;
}
