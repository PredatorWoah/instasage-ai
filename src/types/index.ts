export type Platform = 'all' | 'instagram' | 'facebook' | 'youtube';

export type TimeSeriesPoint = {
  date: string;
  followers?: number;
  views?: number;
  reach?: number;
  engagement?: number;
  posts?: number;
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
  type: 'reel' | 'carousel' | 'post' | 'video' | 'story';
};

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'timing' | 'content' | 'engagement' | 'growth';
  impact: string; // Expected Impact
  effort: 'low' | 'medium' | 'high'; // Difficulty
  estimatedGrowth: string; // e.g. "+12% Followers"
};

export type Report = {
  id: string;
  month: string;
  year: number;
  summary: {
    totalFollowersGained: number;
    totalReach: number;
    totalViews: number;
    avgEngagementRate: number;
  };
  bestPost: Post;
  worstPost: Post;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};
