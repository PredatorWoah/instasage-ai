// Words and features that change with the platform being viewed. "mixed" (Instagram and
// YouTube together) keeps the neutral wording.
export type PlatformMode = 'instagram' | 'youtube' | 'mixed' | 'none';

export function platformMode(platforms: string[]): PlatformMode {
  const set = new Set(platforms);
  if (set.size === 0) return 'none';
  if (set.size > 1) return 'mixed';
  return set.has('youtube') ? 'youtube' : 'instagram';
}

export function terms(mode: PlatformMode) {
  const yt = mode === 'youtube';
  return {
    yt,
    followers: yt ? 'Subscribers' : 'Followers',
    followersLower: yt ? 'subscribers' : 'followers',
    post: yt ? 'video' : 'post',
    posts: yt ? 'videos' : 'posts',
    Posts: yt ? 'Videos' : 'Posts',
    caption: yt ? 'title' : 'caption',
    // Instagram-only numbers the YouTube Data API does not give out
    hasReach: !yt,
    hasSavesShares: !yt,
    hasAudience: !yt,
    formats: yt
      ? [{ value: 'short', label: 'Shorts' }, { value: 'video', label: 'Long videos' }]
      : [{ value: 'reel', label: 'Reels' }, { value: 'carousel', label: 'Carousels' }, { value: 'post', label: 'Photos' }, { value: 'video', label: 'Videos' }, { value: 'short', label: 'YouTube Shorts' }],
    engagementNote: yt ? 'likes and comments per view' : 'likes, comments, saves and shares per account reached',
  };
}

export const formatLabel = (type: string) =>
  ({ reel: 'Reel', carousel: 'Carousel', post: 'Photo', video: 'Video', short: 'Short', story: 'Story' })[type] ?? type;
