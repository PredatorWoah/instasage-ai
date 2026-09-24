export async function getInstagramBusinessProfile(pageAccessToken: string, igBusinessId: string) {
  const url = `https://graph.facebook.com/v19.0/${igBusinessId}?fields=id,username,profile_picture_url,followers_count,follows_count,media_count&access_token=${pageAccessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch Instagram business profile');
  return res.json();
}

export async function getInstagramBusinessMedia(pageAccessToken: string, igBusinessId: string) {
  const url = `https://graph.facebook.com/v19.0/${igBusinessId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&access_token=${pageAccessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch Instagram business media');
  return res.json();
}

export async function getInstagramBusinessInsights(pageAccessToken: string, mediaId: string) {
  const url = `https://graph.facebook.com/v19.0/${mediaId}/insights?metric=impressions,reach,engagement,saved,video_views&access_token=${pageAccessToken}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}
