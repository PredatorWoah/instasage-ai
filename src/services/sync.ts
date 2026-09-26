import { bestThumb, getChannel, getRecentVideos, youtubeKey } from './youtube';
import {
  getInstagramProfile,
  getInstagramMedia,
  getInstagramMediaInsights,
  getInstagramDailyInsights,
  getInstagramDemographics,
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
    if (profile.platform === 'youtube') await syncYouTubeProfile(profile);
    else if (profile.platform === 'instagram') await syncInstagramProfile(profile);

    await prisma.syncJob.update({ where: { id: syncJob.id }, data: { status: 'completed', completedAt: new Date() } });
    await prisma.socialProfile.update({ where: { id: profile.id }, data: { lastSyncedAt: new Date(), isConnected: true } });
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
  });
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

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

async function syncInstagramProfile(profile: SocialProfile & { accessToken: string | null }) {
  const token = await freshInstagramToken({ ...profile, accessToken: profile.accessToken! });
  const ig = await getInstagramProfile(token);
  const igUserId = profile.externalId || ig.user_id;

  const media = await getInstagramMedia(token);
  const failedMetrics = new Set<string>();

  await inBatches(media, 5, async (m) => {
    const { values, failed } = await getInstagramMediaInsights(token, m.id);
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
  });
  if (failedMetrics.size) console.warn('Instagram metrics unavailable on some posts:', [...failedMetrics].join(', '));

  // Daily history: accounts reached per day, and follower totals rebuilt from daily new followers
  const daily = await getInstagramDailyInsights(token, igUserId);
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

  const { audience, warnings } = await getInstagramDemographics(token, igUserId);
  if (warnings.length) console.warn('Instagram demographics:', warnings.join(' | '));
  const hasAudience = Object.values(audience).some((rows) => rows.length > 0);

  await prisma.socialProfile.update({
    where: { id: profile.id },
    data: {
      externalId: igUserId,
      username: ig.username,
      displayName: ig.name || ig.username,
      followerCount: ig.followers_count ?? profile.followerCount,
      profilePictureUrl: ig.profile_picture_url || profile.profilePictureUrl,
      ...(hasAudience ? { audience } : {}),
    },
  });
}
