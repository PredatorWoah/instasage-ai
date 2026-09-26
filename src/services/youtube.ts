import { prisma } from '@/lib/prisma';

// YouTube Data API v3 with an API key: public channel and video numbers, no Google login needed
const API = 'https://www.googleapis.com/youtube/v3';

type Thumbs = Record<string, { url: string } | undefined>;
export type YouTubeChannel = {
  id: string;
  snippet?: { title?: string; customUrl?: string; thumbnails?: Thumbs };
  statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};
export type YouTubeVideo = {
  id: string;
  snippet?: { title?: string; description?: string; publishedAt?: string; thumbnails?: Thumbs; liveBroadcastContent?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
};

export async function youtubeKey(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { youtubeApiKey: true } });
  const key = user?.youtubeApiKey || process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw new Error('Add a YouTube API key first (Accounts page, YouTube section).');
  return key;
}

async function ytGet<T>(path: string, key: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', key);
  const res = await fetch(url, { cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason: string = body?.error?.errors?.[0]?.reason ?? '';
    const message: string = body?.error?.message ?? `YouTube request failed (${res.status})`;
    if (reason === 'keyInvalid' || /api key not valid/i.test(message)) throw new Error('That YouTube API key is not valid. Copy it again from Google Cloud.');
    if (reason === 'accessNotConfigured' || /has not been used|is disabled/i.test(message)) {
      throw new Error('YouTube Data API v3 is not enabled for this key\'s Google Cloud project. Enable it, wait a minute, then try again.');
    }
    if (reason === 'quotaExceeded') throw new Error('YouTube API daily quota used up. It resets at midnight Pacific time.');
    throw new Error(message);
  }
  return body as T;
}

const CHANNEL_PARTS = 'snippet,statistics,contentDetails';

export async function getChannel(key: string, channelId: string) {
  const { items } = await ytGet<{ items?: YouTubeChannel[] }>('channels', key, { part: CHANNEL_PARTS, id: channelId });
  return items?.[0] ?? null;
}

// Accepts @handle, a channel ID (UC...), or any youtube.com channel URL
async function findChannel(key: string, input: string) {
  const value = input.trim().replace(/\/+$/, '');
  const id = value.match(/(UC[\w-]{22})/)?.[1];
  if (id) return getChannel(key, id);
  const handle = value.match(/@([\w.-]+)/)?.[1] ?? value.split('/').pop() ?? value;
  const { items } = await ytGet<{ items?: YouTubeChannel[] }>('channels', key, { part: CHANNEL_PARTS, forHandle: handle });
  return items?.[0] ?? null;
}

// ISO 8601 "PT1M5S" -> 65
export function durationSeconds(iso = '') {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 86400 + (+(m[2] ?? 0)) * 3600 + (+(m[3] ?? 0)) * 60 + (+(m[4] ?? 0));
}

// Shorts can run up to 3 minutes. youtube.com/shorts/<id> only answers 200 for real Shorts
// (long videos redirect to /watch), which is more reliable than guessing from the length.
async function isShort(video: YouTubeVideo) {
  const seconds = durationSeconds(video.contentDetails?.duration);
  if (seconds === 0 || seconds > 180) return false;
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${video.id}`, { method: 'HEAD', redirect: 'manual', cache: 'no-store' });
    if (res.status === 200) return true;
    if (res.status >= 300 && res.status < 400) return false;
  } catch { /* fall through to the heuristic */ }
  return seconds <= 60 || /#shorts?\b/i.test(`${video.snippet?.title} ${video.snippet?.description}`);
}

// The latest uploads (up to 100) with their stats, length and Short/long-form type
export async function getRecentVideos(key: string, channel: YouTubeChannel) {
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];

  const ids: string[] = [];
  let pageToken = '';
  for (let page = 0; page < 2; page++) {
    const list = await ytGet<{ items?: { contentDetails?: { videoId?: string } }[]; nextPageToken?: string }>('playlistItems', key, {
      part: 'contentDetails',
      playlistId: uploads,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    ids.push(...(list.items ?? []).map((i) => i.contentDetails?.videoId).filter((v): v is string => !!v));
    if (!list.nextPageToken) break;
    pageToken = list.nextPageToken;
  }

  const videos: YouTubeVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const { items } = await ytGet<{ items?: YouTubeVideo[] }>('videos', key, { part: 'snippet,statistics,contentDetails', id: ids.slice(i, i + 50).join(',') });
    videos.push(...(items ?? []));
  }
  // Upcoming premieres and live streams have no settled numbers yet
  const settled = videos.filter((v) => v.snippet?.liveBroadcastContent === 'none' || !v.snippet?.liveBroadcastContent);

  const withType: (YouTubeVideo & { short: boolean })[] = [];
  for (let i = 0; i < settled.length; i += 10) {
    const batch = settled.slice(i, i + 10);
    const flags = await Promise.all(batch.map(isShort));
    batch.forEach((v, j) => withType.push({ ...v, short: flags[j] }));
  }
  return withType;
}

export const bestThumb = (t?: Thumbs) => t?.maxres?.url || t?.high?.url || t?.medium?.url || t?.default?.url || '';

// Checks a key with one cheap request before it is saved
export async function saveYouTubeKey(userId: string, rawKey: string) {
  const key = rawKey.trim();
  if (key.length < 20) throw new Error('That does not look like a Google API key. It usually starts with "AIza".');
  await ytGet('channels', key, { part: 'id', forHandle: 'YouTube' });
  await prisma.user.update({ where: { id: userId }, data: { youtubeApiKey: key } });
}

// Creates or updates a YouTube SocialProfile from a handle, ID or URL (several channels allowed)
export async function connectYouTubeProfile(userId: string, channelInput: string) {
  const key = await youtubeKey(userId);
  const channel = await findChannel(key, channelInput);
  if (!channel?.id) throw new Error('YouTube channel not found. Try the @handle exactly as it shows on the channel page, or paste the channel URL.');

  const data = {
    externalId: channel.id,
    username: channel.snippet?.customUrl?.replace(/^@/, '') || channel.id,
    displayName: channel.snippet?.title || 'YouTube channel',
    profilePictureUrl: bestThumb(channel.snippet?.thumbnails),
    followerCount: parseInt(channel.statistics?.subscriberCount || '0', 10),
    isConnected: true,
  };
  const existing = await prisma.socialProfile.findFirst({ where: { userId, platform: 'youtube', externalId: channel.id } });
  if (existing) return prisma.socialProfile.update({ where: { id: existing.id }, data });
  return prisma.socialProfile.create({ data: { ...data, userId, platform: 'youtube' } });
}
