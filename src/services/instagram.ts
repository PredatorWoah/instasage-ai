import { prisma } from '@/lib/prisma';

// Instagram API with Instagram Login (Business and Creator accounts)
const IG = 'https://graph.instagram.com';
const TOKEN_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000;

type IgError = { error?: { message?: string; code?: number } };

async function igGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${IG}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);

  const res = await fetch(url, { cache: 'no-store' });
  const body = (await res.json().catch(() => ({}))) as T & IgError;
  if (!res.ok || body.error) {
    const message = body.error?.message || `Instagram request failed (${res.status})`;
    // 190 = invalid or expired token
    throw new Error(body.error?.code === 190 ? `Instagram token is invalid or expired: ${message}` : message);
  }
  return body;
}

type InstagramProfile = {
  user_id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
};

export type InstagramMedia = {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_product_type?: 'FEED' | 'REELS' | 'STORY' | 'AD';
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  boost_ads_list?: { data?: unknown[] } | unknown[];
};

export function isBoosted(m: InstagramMedia) {
  const ads = m.boost_ads_list;
  if (!ads) return false;
  return Array.isArray(ads) ? ads.length > 0 : (ads.data?.length ?? 0) > 0;
}

export function getInstagramProfile(token: string) {
  return igGet<InstagramProfile>('/me', token, {
    fields: 'user_id,username,name,profile_picture_url,followers_count,media_count',
  });
}

const MEDIA_FIELDS = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';

export async function getInstagramMedia(token: string, limit = 50) {
  // boost_ads_list marks promoted posts; fall back without it if this API version rejects the field
  for (const fields of [`${MEDIA_FIELDS},boost_ads_list`, MEDIA_FIELDS]) {
    try {
      return await fetchMediaPages(token, fields, limit);
    } catch (error) {
      if (fields === MEDIA_FIELDS) throw error;
      console.warn('Instagram media: boost_ads_list unavailable, continuing without it:', (error as Error).message);
    }
  }
  return [];
}

async function fetchMediaPages(token: string, fields: string, limit: number) {
  const media: InstagramMedia[] = [];
  let after: string | undefined;
  while (media.length < limit) {
    const page = await igGet<{ data: InstagramMedia[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      '/me/media',
      token,
      { fields, limit: '25', ...(after ? { after } : {}) },
    );
    media.push(...page.data);
    after = page.paging?.cursors?.after;
    if (!page.paging?.next || !after) break;
  }
  return media.slice(0, limit);
}

const MEDIA_METRICS = ['views', 'reach', 'likes', 'comments', 'saved', 'shares'];

type InsightRow = { name: string; values?: { value: number }[]; total_value?: { value: number } };
const readValue = (m: InsightRow) => m.values?.[0]?.value ?? m.total_value?.value ?? 0;

// Per-post insights. Ask for everything at once; if Instagram rejects any metric for this
// media type, ask for each metric on its own so one unsupported metric never hides the rest.
export async function getInstagramMediaInsights(token: string, mediaId: string) {
  const values: Record<string, number> = {};
  try {
    const res = await igGet<{ data: InsightRow[] }>(`/${mediaId}/insights`, token, { metric: MEDIA_METRICS.join(',') });
    for (const m of res.data) values[m.name] = readValue(m);
    return { values, failed: [] as string[] };
  } catch {
    // fall through to one request per metric
  }

  const failed: string[] = [];
  await Promise.all(
    MEDIA_METRICS.map(async (metric) => {
      try {
        const res = await igGet<{ data: InsightRow[] }>(`/${mediaId}/insights`, token, { metric });
        for (const m of res.data) values[m.name] = readValue(m);
      } catch (error) {
        failed.push(`${metric}: ${(error as Error).message}`);
      }
    }),
  );
  return { values, failed };
}

const day = (d: Date) => d.toISOString().slice(0, 10);

// Daily account history for the last 30 days: accounts reached and new followers per day
export async function getInstagramDailyInsights(token: string, igUserId: string) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 29 * 24 * 60 * 60;
  const reach = new Map<string, number>();
  const newFollowers = new Map<string, number>();
  const warnings: string[] = [];

  const series = async (metric: string, target: Map<string, number>) => {
    try {
      const res = await igGet<{ data: { values?: { value: number; end_time: string }[] }[] }>(`/${igUserId}/insights`, token, {
        metric,
        period: 'day',
        metric_type: 'time_series',
        since: String(since),
        until: String(until),
      });
      for (const v of res.data[0]?.values ?? []) {
        // end_time marks the end of the day being measured
        target.set(day(new Date(new Date(v.end_time).getTime() - 1000)), v.value);
      }
    } catch (error) {
      warnings.push(`${metric}: ${(error as Error).message}`);
    }
  };

  await Promise.all([series('reach', reach), series('follower_count', newFollowers)]);
  return { reach, newFollowers, warnings };
}

type AudienceBreakdown = {
  age: { label: string; value: number }[];
  gender: { label: string; value: number }[];
  country: { label: string; value: number }[];
  city: { label: string; value: number }[];
};

// Follower demographics (Instagram only reports these for accounts with 100+ followers)
export async function getInstagramDemographics(token: string, igUserId: string) {
  const result: AudienceBreakdown = { age: [], gender: [], country: [], city: [] };
  const warnings: string[] = [];

  for (const breakdown of ['age', 'gender', 'country', 'city'] as const) {
    let rows: { dimension_values: string[]; value: number }[] | undefined;
    // Newer API versions reject "timeframe", older ones require it
    for (const extra of [{}, { timeframe: 'this_month' }] as Record<string, string>[]) {
      try {
        const res = await igGet<{ data: { total_value?: { breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } }[] }>(
          `/${igUserId}/insights`,
          token,
          { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', breakdown, ...extra },
        );
        rows = res.data[0]?.total_value?.breakdowns?.[0]?.results ?? [];
        break;
      } catch (error) {
        if (Object.keys(extra).length) warnings.push(`${breakdown}: ${(error as Error).message}`);
      }
    }
    result[breakdown] = (rows ?? [])
      .map((r) => ({ label: r.dimension_values[0], value: r.value }))
      .sort((a, b) => b.value - a.value);
  }
  return { audience: result, warnings };
}

// Long-lived tokens last 60 days and can be refreshed once they are at least 24 hours old
export async function refreshInstagramToken(token: string) {
  const res = await igGet<{ access_token: string; expires_in: number }>('/refresh_access_token', token, {
    grant_type: 'ig_refresh_token',
  });
  return { token: res.access_token, expiresAt: new Date(Date.now() + res.expires_in * 1000) };
}

export async function connectInstagramProfile(userId: string, rawToken: string) {
  const token = rawToken.trim();
  const ig = await getInstagramProfile(token);

  const data = {
    externalId: ig.user_id,
    username: ig.username,
    displayName: ig.name || ig.username,
    profilePictureUrl: ig.profile_picture_url || '',
    followerCount: ig.followers_count ?? 0,
    accessToken: token,
    tokenExpiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS),
    isConnected: true,
  };

  // One profile per Instagram account, so connecting another account adds it instead of replacing
  const existing = await prisma.socialProfile.findFirst({
    where: { userId, platform: 'instagram', OR: [{ externalId: ig.user_id }, { externalId: null, username: ig.username }] },
  });
  if (existing) {
    return prisma.socialProfile.update({ where: { id: existing.id }, data });
  }
  return prisma.socialProfile.create({ data: { ...data, userId, platform: 'instagram' } });
}

// ---------- Instagram Business Login (OAuth) ----------

const INSTAGRAM_SCOPES = ['instagram_business_basic', 'instagram_business_manage_insights'];

export function instagramOAuthConfig() {
  // Trim: a stray space or newline from copy-paste makes Instagram reject the app ("Invalid platform app")
  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  return appId && appSecret ? { appId, appSecret } : null;
}

export function instagramAuthorizeUrl(appId: string, redirectUri: string, state: string) {
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', INSTAGRAM_SCOPES.join(','));
  url.searchParams.set('state', state);
  // Always show the login screen so a different Instagram account can be picked
  url.searchParams.set('force_reauth', 'true');
  return url.toString();
}

// Code -> short-lived token (1 hour) -> long-lived token (60 days)
export async function exchangeInstagramCode(code: string, redirectUri: string) {
  const config = instagramOAuthConfig();
  if (!config) throw new Error('Instagram login is not set up. Add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET.');

  const form = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code: code.replace(/#_$/, ''),
  });
  const res = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form, cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  // Some API versions wrap the result in { data: [...] }
  const short = Array.isArray(body?.data) ? body.data[0] : body;
  if (!res.ok || !short?.access_token) {
    throw new Error(body?.error_message || body?.error?.message || `Instagram login failed (${res.status})`);
  }

  const long = await igGet<{ access_token: string; expires_in: number }>('/access_token', short.access_token, {
    grant_type: 'ig_exchange_token',
    client_secret: config.appSecret,
  });
  return long.access_token;
}
