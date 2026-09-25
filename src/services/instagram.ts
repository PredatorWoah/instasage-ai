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

export type InstagramProfile = {
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
};

export function getInstagramProfile(token: string) {
  return igGet<InstagramProfile>('/me', token, {
    fields: 'user_id,username,name,profile_picture_url,followers_count,media_count',
  });
}

export async function getInstagramMedia(token: string, limit = 50) {
  const media: InstagramMedia[] = [];
  let after: string | undefined;
  while (media.length < limit) {
    const page = await igGet<{ data: InstagramMedia[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      '/me/media',
      token,
      {
        fields: 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
        limit: '25',
        ...(after ? { after } : {}),
      },
    );
    media.push(...page.data);
    after = page.paging?.cursors?.after;
    if (!page.paging?.next || !after) break;
  }
  return media.slice(0, limit);
}

// Per-post insights. Not every metric exists for every media type, so fall back to fewer metrics.
export async function getInstagramMediaInsights(token: string, mediaId: string) {
  const attempts = ['reach,saved,shares,views', 'reach,saved,shares', 'reach'];
  for (const metric of attempts) {
    try {
      const res = await igGet<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
        `/${mediaId}/insights`,
        token,
        { metric },
      );
      const values: Record<string, number> = {};
      for (const m of res.data) values[m.name] = m.values?.[0]?.value ?? m.total_value?.value ?? 0;
      return values;
    } catch {
      // try the next, smaller metric set
    }
  }
  return {};
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

  const existing = await prisma.socialProfile.findFirst({ where: { userId, platform: 'instagram' } });
  if (existing) {
    return prisma.socialProfile.update({ where: { id: existing.id }, data });
  }
  return prisma.socialProfile.create({ data: { ...data, userId, platform: 'instagram' } });
}
