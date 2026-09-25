import { getYouTubeChannelInfo, getYouTubeVideos } from './youtube';
import { getInstagramProfile, getInstagramMedia, getInstagramMediaInsights, refreshInstagramToken, type InstagramMedia } from './instagram';
import { prisma } from '@/lib/prisma';

export async function syncSocialProfile(profileId: string) {
  const profile = await prisma.socialProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw new Error('Profile not found');
  if (profile.platform === 'youtube' && !profile.externalId) throw new Error('YouTube channel ID missing. Reconnect the channel.');
  if (profile.platform === 'instagram' && !profile.accessToken) throw new Error('Instagram access token missing');

  const syncJob = await prisma.syncJob.create({
    data: {
      socialProfileId: profile.id,
      platform: profile.platform,
      status: 'running',
    },
  });

  try {
    if (profile.platform === 'youtube') {
      await syncYouTubeProfile(profile);
    } else if (profile.platform === 'instagram') {
      await syncInstagramProfile(profile);
    }

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { status: 'completed', completedAt: new Date() },
    });

    await prisma.socialProfile.update({
      where: { id: profile.id },
      data: { lastSyncedAt: new Date(), isConnected: true },
    });

  } catch (error: any) {
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { status: 'failed', completedAt: new Date(), errorMessage: error.message },
    });

    if (error.message.includes('token') || error.message.includes('auth')) {
      await prisma.socialProfile.update({
        where: { id: profile.id },
        data: { isConnected: false },
      });
    }
    throw error;
  }
}

async function syncYouTubeProfile(profile: any) {
  const channel = await getYouTubeChannelInfo(profile.externalId);
  if (!channel) throw new Error('Could not fetch YouTube channel');

  const stats = channel.statistics;
  const followerCount = parseInt(stats?.subscriberCount || '0', 10);
  const viewsCount = parseInt(stats?.viewCount || '0', 10);
  const videoCount = parseInt(stats?.videoCount || '0', 10);

  await prisma.socialProfile.update({
    where: { id: profile.id },
    data: {
      followerCount,
      displayName: channel.snippet?.title || profile.displayName,
      profilePictureUrl: channel.snippet?.thumbnails?.default?.url || profile.profilePictureUrl
    },
  });

  await prisma.metric.create({
    data: {
      socialProfileId: profile.id,
      date: new Date(),
      followers: followerCount,
      views: viewsCount,
      postsCount: videoCount,
    }
  });

  const videos = await getYouTubeVideos(profile.externalId);
  if (videos && videos.length > 0) {
    for (const video of videos) {
      if (!video.id) continue;
      const vStats = video.statistics;

      const views = parseInt(vStats?.viewCount || '0', 10);
      const likes = parseInt(vStats?.likeCount || '0', 10);
      const comments = parseInt(vStats?.commentCount || '0', 10);
      const engagement = (views > 0) ? ((likes + comments) / views) * 100 : 0;

      await prisma.post.upsert({
        where: { id: video.id },
        update: {
          views,
          likes,
          comments,
          performanceScore: engagement,
          thumbnail: video.snippet?.thumbnails?.medium?.url || '',
          caption: video.snippet?.title || '',
        },
        create: {
          id: video.id,
          socialProfileId: profile.id,
          platform: 'youtube',
          type: 'video',
          publishedAt: new Date(video.snippet?.publishedAt || new Date()),
          views,
          likes,
          comments,
          saves: 0,
          shares: 0,
          performanceScore: engagement,
          thumbnail: video.snippet?.thumbnails?.medium?.url || '',
          caption: video.snippet?.title || '',
        }
      });
    }
  }
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

async function syncInstagramProfile(profile: any) {
  const token = await freshInstagramToken(profile);
  const ig = await getInstagramProfile(token);

  await prisma.socialProfile.update({
    where: { id: profile.id },
    data: {
      username: ig.username,
      displayName: ig.name || ig.username,
      followerCount: ig.followers_count ?? profile.followerCount,
      profilePictureUrl: ig.profile_picture_url || profile.profilePictureUrl,
    },
  });

  const media = await getInstagramMedia(token);
  let totalReach = 0;
  let totalViews = 0;

  for (const m of media) {
    const insights = await getInstagramMediaInsights(token, m.id);
    const likes = m.like_count ?? 0;
    const comments = m.comments_count ?? 0;
    const saves = insights.saved ?? 0;
    const shares = insights.shares ?? 0;
    const reach = insights.reach ?? 0;
    const views = insights.views ?? reach;
    totalReach += reach;
    totalViews += views;

    // Engagement rate by reach, the usual Instagram definition
    const performanceScore = reach > 0 ? ((likes + comments + saves + shares) / reach) * 100 : 0;
    const fields = {
      views,
      likes,
      comments,
      saves,
      shares,
      performanceScore,
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
  }

  await prisma.metric.create({
    data: {
      socialProfileId: profile.id,
      date: new Date(),
      followers: ig.followers_count ?? null,
      views: totalViews,
      reach: totalReach,
      postsCount: ig.media_count ?? media.length,
    },
  });
}
