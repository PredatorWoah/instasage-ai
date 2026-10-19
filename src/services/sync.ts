import { bestThumb, getChannel, getRecentVideos, youtubeKey } from './youtube';
import {
  getInstagramProfile,
  getInstagramMedia,
  getInstagramMediaIds,
  getInstagramMediaInsights,
  getInstagramDailyInsights,
  getInstagramDemographics,
  getInstagramReachTotal,
  getInstagramReelMetrics,
  getInstagramFunnel,
  refreshInstagramToken,
  isBoosted,
  type InstagramMedia,
} from './instagram';
import { prisma } from '@/lib/prisma';
import type { SocialProfile } from '@prisma/client';

export async function syncSocialProfile(profileId: string) {
  const profile = await prisma.socialProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new Error('Profile not found');
  if (profile.platform === 'youtube' && !profile.externalId) throw new Error('YouTube channel ID missing. Reconnect the channel.');
  if (profile.platform === 'instagram' && !profile.accessToken) throw new Error('Instagram access token missing');

  const syncJob = await prisma.syncJob.create({ data: { socialProfileId: profile.id, platform: profile.platform, status: 'running' } });

  try {
    const result = profile.platform === 'youtube' ? await syncYouTubeProfile(profile) : await syncInstagramProfile(profile);

    await prisma.syncJob.update({ where: { id: syncJob.id }, data: { status: 'completed', completedAt: new Date() } });
    await prisma.socialProfile.update({ where: { id: profile.id }, data: { lastSyncedAt: new Date(), isConnected: true } });
    // What the platform reported this time, so the UI can say so
    return { previous: profile.followerCount, followers: result.followers, posts: result.posts };
  } catch (error) {
    const message = (error as Error).message;
    await prisma.syncJob.update({ where: { id: syncJob.id }, data: { status: 'failed', completedAt: new Date(), errorMessage: message } });
    if (/token|auth/i.test(message)) {
      await prisma.socialProfile.update({ where: { id: profile.id }, data: { isConnected: false } });
    }
    throw error;
  }
}

async function syncYouTubeProfile(profile: SocialProfile) {
  const key = await youtubeKey(profile.userId);
  const channel = await getChannel(key, profile.externalId!);
  if (!channel) throw new Error('Could not find this YouTube channel any more. Was it deleted or renamed?');

  const stats = channel.statistics;
  const followerCount = parseInt(stats?.subscriberCount || '0', 10);
  await prisma.socialProfile.update({
    where: { id: profile.id },
    data: {
      followerCount,
      displayName: channel.snippet?.title || profile.displayName,
      username: channel.snippet?.customUrl?.replace(/^@/, '') || profile.username,
      profilePictureUrl: bestThumb(channel.snippet?.thumbnails) || profile.profilePictureUrl,
    },
  });

  // Daily snapshot: subscribers and lifetime channel views (the day to day difference is views gained)
  const metricId = `${profile.id}:${dayKey(new Date())}`;
  const snapshot = {
    followers: followerCount,
    views: parseInt(stats?.viewCount || '0', 10),
    postsCount: parseInt(stats?.videoCount || '0', 10),
  };
  await prisma.metric.upsert({
    where: { id: metricId },
    update: snapshot,
    create: { ...snapshot, id: metricId, socialProfileId: profile.id, date: new Date() },
  });

  const videos = await getRecentVideos(key, channel);
  await inBatches(videos, 10, async (video) => {
    const views = parseInt(video.statistics?.viewCount || '0', 10);
    const likes = parseInt(video.statistics?.likeCount || '0', 10);
    const comments = parseInt(video.statistics?.commentCount || '0', 10);
    const fields = {
      views,
      likes,
      comments,
      // YouTube's usual engagement rate: likes and comments per view
      performanceScore: views > 0 ? ((likes + comments) / views) * 100 : 0,
      thumbnail: bestThumb(video.snippet?.thumbnails),
      caption: video.snippet?.title || '',
      type: video.short ? 'short' : 'video',
      permalink: video.short ? `https://www.youtube.com/shorts/${video.id}` : `https://www.youtube.com/watch?v=${video.id}`,
    };
    await prisma.post.upsert({
      where: { id: video.id },
      update: fields,
      create: {
        ...fields,
        id: video.id,
        socialProfileId: profile.id,
        platform: 'youtube',
        publishedAt: new Date(video.snippet?.publishedAt || Date.now()),
        saves: 0,
        shares: 0,
      },
    });
    await snapshotPost(video.id, new Date(video.snippet?.publishedAt || Date.now()), { views, reach: null, likes, comments, saves: 0, shares: 0 });
  });
  return { followers: followerCount, posts: videos.length };
}

// Keeps the 60-day token alive: refresh once it is more than a week old
async function freshInstagramToken(profile: { id: string; accessToken: string; tokenExpiresAt: Date | null }) {
  const refreshAfter = Date.now() + 53 * 24 * 60 * 60 * 1000;
  if (profile.tokenExpiresAt && profile.tokenExpiresAt.getTime() > refreshAfter) return profile.accessToken;
  try {
    const { token, expiresAt } = await refreshInstagramToken(profile.accessToken);
    await prisma.socialProfile.update({ where: { id: profile.id }, data: { accessToken: token, tokenExpiresAt: expiresAt } });
    return token;
  } catch (error) {
    // A token younger than 24 hours cannot be refreshed yet; keep using it
    console.warn('Instagram token refresh skipped:', (error as Error).message);
    return profile.accessToken;
  }
}

function instagramPostType(m: InstagramMedia) {
  if (m.media_product_type === 'REELS') return 'reel';
  if (m.media_product_type === 'STORY') return 'story';
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carousel';
  if (m.media_type === 'VIDEO') return 'video';
  return 'post';
}

// Growth curve points for posts in their first two weeks (one per hour since posting; repeat syncs overwrite)
async function snapshotPost(postId: string, publishedAt: Date, n: { views: number; reach: number | null; likes: number; comments: number; saves: number; shares: number }) {
  const hours = Math.floor((Date.now() - publishedAt.getTime()) / 3_600_000);
  if (hours < 0 || hours > 14 * 24) return;
  const id = `${postId}:${hours}`;
  await prisma.postSnapshot.upsert({ where: { id }, update: { ...n, takenAt: new Date() }, create: { id, postId, hours, ...n } }).catch(() => {});
}

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// Posts archived or deleted on Instagram drop out of the API, so drop them here too; otherwise old
// content (say, from before an account changed direction) keeps skewing averages and AI advice.
// Only runs when Instagram returned the complete list, so a partial answer never deletes anything.
async function pruneGonePosts(profileId: string, token: string, fetched: string[]) {
  let live: Set<string> | null;
  try {
    live = await getInstagramMediaIds(token);
  } catch (error) {
    console.warn('Instagram media list unavailable, skipping cleanup:', (error as Error).message);
    return 0;
  }
  if (!live || live.size === 0) return 0;
  for (const id of fetched) live.add(id);
  const stored = await prisma.post.findMany({ where: { socialProfileId: profileId }, select: { id: true } });
  const gone = stored.map((p) => p.id).filter((id) => !live!.has(id));
  if (!gone.length) return 0;
  await prisma.post.deleteMany({ where: { id: { in: gone }, socialProfileId: profileId } });
  // Cached AI answers were built on those posts
  const owner = await prisma.socialProfile.findUnique({ where: { id: profileId }, select: { userId: true } });
  if (owner) await prisma.aiResult.deleteMany({ where: { userId: owner.userId, NOT: { kind: { startsWith: 'report:' } } } });
  console.log(`Removed ${gone.length} posts no longer on Instagram (archived or deleted)`);
  return gone.length;
}

async function syncInstagramProfile(profile: SocialProfile & { accessToken: string | null }) {
  const token = await freshInstagramToken({ ...profile, accessToken: profile.accessToken! });
  const ig = await getInstagramProfile(token);
  const igUserId = profile.externalId || ig.user_id;
  const followerCount = ig.followers_count ?? profile.followerCount;

  // Save the headline numbers first: the posts and insights below take a while, and a slow or
  // failed step there must not leave the follower count stuck on an old value
  await prisma.socialProfile.update({
    where: { id: profile.id },
    data: {
      externalId: igUserId,
      username: ig.username,
      displayName: ig.name || ig.username,
      followerCount,
      profilePictureUrl: ig.profile_picture_url || profile.profilePictureUrl,
    },
  });
  const todayKey = dayKey(new Date());
  await prisma.metric.upsert({
    where: { id: `${profile.id}:${todayKey}` },
    update: { followers: followerCount },
    create: { id: `${profile.id}:${todayKey}`, socialProfileId: profile.id, date: new Date(`${todayKey}T12:00:00Z`), followers: followerCount },
  });

  const media = await getInstagramMedia(token);
  await pruneGonePosts(profile.id, token, media.map((m) => m.id));
  const failedMetrics = new Set<string>();

  // Account-level numbers don't depend on the posts, so ask for them while the posts are fetched
  const accountLevel = Promise.all([
    getInstagramDailyInsights(token, igUserId),
    getInstagramReachTotal(token, igUserId),
    getInstagramFunnel(token, igUserId),
    getInstagramDemographics(token, igUserId),
  ]);
  // Keep a failure here from surfacing as an unhandled rejection before it is awaited below
  accountLevel.catch(() => {});

  // Watch time and skip rate barely move once a reel is a month old, so older reels are asked once
  const watched = new Set((await prisma.post.findMany({ where: { socialProfileId: profile.id, avgWatchMs: { not: null } }, select: { id: true } })).map((p) => p.id));

  await inBatches(media, 5, async (m) => {
    const askReel = m.media_product_type === 'REELS' && (Date.now() - Date.parse(m.timestamp) < 30 * 86_400_000 || !watched.has(m.id));
    const [{ values, failed }, reel] = await Promise.all([
      getInstagramMediaInsights(token, m.id),
      askReel ? getInstagramReelMetrics(token, m.id) : Promise.resolve(null),
    ]);
    failed.forEach((f) => failedMetrics.add(f.split(':')[0]));
    if (failed.length) console.warn(`Instagram insights for ${m.id} (${m.media_product_type}/${m.media_type}) missing:`, failed.join(' | '));

    // Public counters can lag or hide likes; insights are the source of truth when present
    const likes = Math.max(m.like_count ?? 0, values.likes ?? 0);
    const comments = Math.max(m.comments_count ?? 0, values.comments ?? 0);
    const saves = values.saved ?? 0;
    const shares = values.shares ?? 0;
    const reach = values.reach ?? null;
    const views = values.views ?? 0;

    // Engagement rate by reach, the usual Instagram definition
    const performanceScore = reach ? ((likes + comments + saves + shares) / reach) * 100 : 0;
    const fields = {
      views,
      reach,
      likes,
      comments,
      saves,
      shares,
      performanceScore,
      permalink: m.permalink ?? null,
      isBoosted: isBoosted(m),
      thumbnail: m.thumbnail_url || (m.media_type === 'VIDEO' ? '' : m.media_url) || '',
      caption: m.caption || '',
      ...(reel ? { avgWatchMs: reel.avgWatchMs, skipRate: reel.skipRate } : {}),
    };

    await prisma.post.upsert({
      where: { id: m.id },
      update: fields,
      create: {
        ...fields,
        id: m.id,
        socialProfileId: profile.id,
        platform: 'instagram',
        type: instagramPostType(m),
        publishedAt: new Date(m.timestamp),
      },
    });
    await snapshotPost(m.id, new Date(m.timestamp), { views, reach, likes, comments, saves, shares });
  });
  if (failedMetrics.size) console.warn('Instagram metrics unavailable on some posts:', [...failedMetrics].join(', '));

  const [daily, reach30, funnel, { audience, warnings }] = await accountLevel;

  // Daily history: accounts reached per day, and follower totals rebuilt from daily new followers
  if (daily.warnings.length) console.warn('Instagram daily insights:', daily.warnings.join(' | '));

  const followers = new Map<string, number>();
  if (ig.followers_count != null) {
    let running = ig.followers_count;
    for (let i = 0; i < 30; i++) {
      const key = dayKey(new Date(Date.now() - i * 86_400_000));
      followers.set(key, running);
      running -= daily.newFollowers.get(key) ?? 0;
    }
  }

  const days = new Set([...daily.reach.keys(), ...followers.keys()]);
  for (const key of days) {
    const data = { followers: followers.get(key) ?? null, reach: daily.reach.get(key) ?? null };
    await prisma.metric.upsert({
      where: { id: `${profile.id}:${key}` },
      update: data,
      create: { ...data, id: `${profile.id}:${key}`, socialProfileId: profile.id, date: new Date(`${key}T12:00:00Z`) },
    });
  }
  const todayId = `${profile.id}:${dayKey(new Date())}`;
  await prisma.metric.update({ where: { id: todayId }, data: { postsCount: ig.media_count ?? media.length } }).catch(() => {});

  const hasFunnel = Object.values(funnel).some((v) => v != null);
  if (warnings.length) console.warn('Instagram demographics:', warnings.join(' | '));
  const hasAudience = Object.values(audience).some((rows) => rows.length > 0);

  await prisma.socialProfile.update({
    where: { id: profile.id },
    data: {
      ...(hasAudience ? { audience } : {}),
      ...(reach30 != null ? { reach30 } : {}),
      ...(hasFunnel ? { funnel: { ...funnel, at: new Date().toISOString() } } : {}),
    },
  });
  return { followers: followerCount, posts: media.length };
}

// Cheap refresh between full syncs: the follower or subscriber count and today's snapshot,
// without pulling every post's insights again. Returns whether the count changed.
export async function refreshProfileLight(profileId: string) {
  const profile = await prisma.socialProfile.findUnique({ where: { id: profileId } });
  if (!profile) return false;

  let followerCount = profile.followerCount;
  let views: number | undefined;
  const identity: { displayName?: string; username?: string; profilePictureUrl?: string } = {};

  if (profile.platform === 'instagram') {
    if (!profile.accessToken) return false;
    const token = await freshInstagramToken({ ...profile, accessToken: profile.accessToken });
    const ig = await getInstagramProfile(token);
    followerCount = ig.followers_count ?? followerCount;
    identity.username = ig.username;
    identity.displayName = ig.name || ig.username;
    if (ig.profile_picture_url) identity.profilePictureUrl = ig.profile_picture_url;
  } else if (profile.platform === 'youtube' && profile.externalId) {
    const channel = await getChannel(await youtubeKey(profile.userId), profile.externalId);
    if (!channel) return false;
    followerCount = parseInt(channel.statistics?.subscriberCount || '0', 10);
    views = parseInt(channel.statistics?.viewCount || '0', 10);
  } else {
    return false;
  }

  await prisma.socialProfile.update({ where: { id: profile.id }, data: { followerCount, ...identity } });
  const key = dayKey(new Date());
  const snapshot = { followers: followerCount, ...(views != null ? { views } : {}) };
  await prisma.metric.upsert({
    where: { id: `${profile.id}:${key}` },
    update: snapshot,
    create: { ...snapshot, id: `${profile.id}:${key}`, socialProfileId: profile.id, date: new Date(`${key}T12:00:00Z`) },
  });
  return followerCount !== profile.followerCount;
}
