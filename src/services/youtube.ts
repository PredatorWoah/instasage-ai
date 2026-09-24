import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

const youtube = google.youtube('v3');

function apiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not set');
  return key;
}

const CHANNEL_PARTS = ['snippet', 'statistics', 'contentDetails'];

export async function getYouTubeChannelInfo(channelId: string) {
  const response = await youtube.channels.list({ key: apiKey(), part: CHANNEL_PARTS, id: [channelId] });
  return response.data.items?.[0];
}

// Accepts @handle, a channel ID (UC...), or a youtube.com channel URL
async function findChannel(input: string) {
  const value = input.trim().replace(/\/+$/, '');
  const idMatch = value.match(/(UC[\w-]{22})/);
  if (idMatch) return getYouTubeChannelInfo(idMatch[1]);

  const handle = value.match(/@([\w.-]+)/)?.[1] ?? value;
  const response = await youtube.channels.list({ key: apiKey(), part: CHANNEL_PARTS, forHandle: handle });
  return response.data.items?.[0];
}

export async function getYouTubeVideos(channelId: string) {
  const channelInfo = await getYouTubeChannelInfo(channelId);
  if (!channelInfo) return null;

  const uploadsPlaylistId = channelInfo.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return [];

  const response = await youtube.playlistItems.list({
    key: apiKey(),
    part: ['snippet'],
    playlistId: uploadsPlaylistId,
    maxResults: 50,
  });

  const videoIds = response.data.items?.map((item) => item.snippet?.resourceId?.videoId).filter(Boolean) as string[];
  if (!videoIds.length) return [];

  const videosResponse = await youtube.videos.list({
    key: apiKey(),
    part: ['snippet', 'statistics'],
    id: videoIds,
  });

  return videosResponse.data.items;
}

// Creates or updates the user's YouTube SocialProfile from a handle, ID or URL
export async function connectYouTubeProfile(userId: string, channelInput: string) {
  const channel = await findChannel(channelInput);
  if (!channel?.id) throw new Error('YouTube channel not found. Try your @handle or the channel URL.');

  const data = {
    externalId: channel.id,
    username: channel.snippet?.customUrl?.replace(/^@/, '') || channel.id,
    displayName: channel.snippet?.title || 'YouTube Channel',
    profilePictureUrl: channel.snippet?.thumbnails?.default?.url || '',
    followerCount: parseInt(channel.statistics?.subscriberCount || '0', 10),
    isConnected: true,
  };

  const existing = await prisma.socialProfile.findFirst({ where: { userId, platform: 'youtube' } });
  if (existing) {
    return prisma.socialProfile.update({ where: { id: existing.id }, data });
  }
  return prisma.socialProfile.create({ data: { ...data, userId, platform: 'youtube' } });
}
