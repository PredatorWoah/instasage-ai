import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

const youtube = google.youtube('v3');

export async function getYouTubeChannelInfo(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const response = await youtube.channels.list({
    auth,
    part: ['snippet', 'statistics', 'contentDetails'],
    mine: true,
  });

  return response.data.items?.[0];
}

export async function getYouTubeVideos(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const channelInfo = await getYouTubeChannelInfo(accessToken);
  if (!channelInfo) return null;

  const uploadsPlaylistId = channelInfo.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return [];

  const response = await youtube.playlistItems.list({
    auth,
    part: ['snippet'],
    playlistId: uploadsPlaylistId,
    maxResults: 50,
  });

  const videoIds = response.data.items?.map((item) => item.snippet?.resourceId?.videoId).filter(Boolean) as string[];
  if (!videoIds.length) return [];

  const videosResponse = await youtube.videos.list({
    auth,
    part: ['snippet', 'statistics'],
    id: videoIds,
  });

  return videosResponse.data.items;
}

type GoogleTokens = {
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
};

// Creates or refreshes the user's YouTube SocialProfile from a Google OAuth grant
export async function connectYouTubeProfile(userId: string, tokens: GoogleTokens) {
  if (!tokens.access_token) return;
  const channel = await getYouTubeChannelInfo(tokens.access_token);
  if (!channel?.id) return;

  const data = {
    username: channel.snippet?.customUrl?.replace(/^@/, '') || channel.id,
    displayName: channel.snippet?.title || 'YouTube Channel',
    profilePictureUrl: channel.snippet?.thumbnails?.default?.url || '',
    followerCount: parseInt(channel.statistics?.subscriberCount || '0', 10),
    accessToken: tokens.access_token,
    tokenExpiresAt: tokens.expires_at ? new Date(tokens.expires_at * 1000) : null,
    isConnected: true,
  };

  const existing = await prisma.socialProfile.findFirst({ where: { userId, platform: 'youtube' } });
  if (existing) {
    await prisma.socialProfile.update({ where: { id: existing.id }, data });
  } else {
    await prisma.socialProfile.create({ data: { ...data, userId, platform: 'youtube' } });
  }
}

// Returns a valid Google access token for the profile, refreshing it if it has expired
export async function getFreshYouTubeToken(profile: {
  id: string;
  userId: string;
  accessToken: string | null;
  tokenExpiresAt: Date | null;
}) {
  const stillValid = profile.tokenExpiresAt && profile.tokenExpiresAt.getTime() > Date.now() + 60_000;
  if (profile.accessToken && stillValid) return profile.accessToken;

  const account = await prisma.account.findFirst({
    where: { userId: profile.userId, provider: 'google', refresh_token: { not: null } },
  });
  if (!account?.refresh_token) throw new Error('YouTube token expired. Please reconnect your account.');

  const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: account.refresh_token });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error('YouTube token refresh failed. Please reconnect your account.');

  await prisma.socialProfile.update({
    where: { id: profile.id },
    data: {
      accessToken: credentials.access_token,
      tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
    },
  });
  return credentials.access_token;
}
