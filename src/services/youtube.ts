import { google } from 'googleapis';

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
