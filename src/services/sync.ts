import { getYouTubeChannelInfo, getYouTubeVideos } from './youtube';
import { getInstagramBusinessProfile, getInstagramBusinessMedia, getInstagramBusinessInsights } from './meta';
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

async function syncInstagramProfile(profile: any) {
  // Using pageAccessToken for IG Graph API
  const igProfile = await getInstagramBusinessProfile(profile.accessToken, profile.username /* Note: Usually graph api needs numerical IG ID, mapped from username or retrieved via accounts API */); // username here is acting as the IG Business ID if configured that way

  await prisma.socialProfile.update({
    where: { id: profile.id },
    data: {
      followerCount: igProfile.followers_count,
      profilePictureUrl: igProfile.profile_picture_url || profile.profilePictureUrl
    },
  });

  await prisma.metric.create({
    data: {
      socialProfileId: profile.id,
      date: new Date(),
      followers: igProfile.followers_count,
      postsCount: igProfile.media_count,
    }
  });

  const media = await getInstagramBusinessMedia(profile.accessToken, profile.username);
  if (media && media.data) {
    for (const m of media.data) {
      // Basic metrics available without insights query
      let views = 0;
      let reach = 0;
      let saves = 0;
      const shares = 0;

      try {
        const insights = await getInstagramBusinessInsights(profile.accessToken, m.id);
        if (insights && insights.data) {
          const reachMetric = insights.data.find((i: any) => i.name === 'reach');
          const savedMetric = insights.data.find((i: any) => i.name === 'saved');
          const viewsMetric = insights.data.find((i: any) => i.name === 'video_views' || i.name === 'impressions');

          if (reachMetric) reach = reachMetric.values[0].value;
          if (savedMetric) saves = savedMetric.values[0].value;
          if (viewsMetric) views = viewsMetric.values[0].value;
        }
      } catch {
        // IG insights can throw errors for certain media types, fail gracefully
      }

      const likes = m.like_count || 0;
      const comments = m.comments_count || 0;

      const totalEngagements = likes + comments + saves + shares;
      const performanceScore = reach > 0 ? (totalEngagements / reach) * 100 : 0;

      await prisma.post.upsert({
        where: { id: m.id },
        update: {
          views,
          likes,
          comments,
          saves,
          shares,
          performanceScore,
          thumbnail: m.thumbnail_url || m.media_url || '',
          caption: m.caption || '',
        },
        create: {
          id: m.id,
          socialProfileId: profile.id,
          platform: 'instagram',
          type: m.media_type === 'VIDEO' ? 'reel' : m.media_type === 'CAROUSEL_ALBUM' ? 'carousel' : 'post',
          publishedAt: new Date(m.timestamp || new Date()),
          views,
          likes,
          comments,
          saves,
          shares,
          performanceScore,
          thumbnail: m.thumbnail_url || m.media_url || '',
          caption: m.caption || '',
        }
      });
    }
  }
}
