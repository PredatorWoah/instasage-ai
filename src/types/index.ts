export type Platform = 'all' | 'instagram' | 'facebook' | 'youtube';

export type TimeSeriesPoint = {
  date: string;
  followers?: number;
  views?: number;
  reach?: number;
  engagement?: number;
  posts?: number;
  channelViews?: number; // YouTube: channel views gained that day
};

export type Post = {
  permalink?: string | null;
  isBoosted?: boolean;
  username?: string;
  reach?: number | null;
  id: string;
  thumbnail: string;
  caption: string;
  platform: Platform;
  views: number;
  likes: number;
  comments: number;
  saves: number; // saves field
  shares: number;
  performanceScore: number;
  publishedAt: string;
  type: 'reel' | 'carousel' | 'post' | 'video' | 'short' | 'story';
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};
