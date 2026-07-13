export type Platform = 'all' | 'instagram' | 'facebook' | 'youtube';

export type PlatformInfo = {
  id: Platform;
  label: string;
  color: string;
};

export type MetricTrend = 'up' | 'down' | 'neutral';

export type KPIMetric = {
  id: string;
  label: string;
  value: string;
  change: string;
  changePercent: number;
  trend: MetricTrend;
  icon: string;
  color: string;
};

export type TimeSeriesPoint = {
  date: string;
  followers?: number;
  views?: number;
  reach?: number;
  engagement?: number;
  posts?: number;
};

export type Post = {
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

export type Insight = {
  id: string;
  title: string;
  description: string; // Explanation
  impact: 'high' | 'medium' | 'low'; // Mapping to priority/impact
  category: 'timing' | 'content' | 'audience' | 'growth' | 'engagement';
  metric?: string;
  metricValue?: string;
  confidenceScore: number; // e.g. 94
  suggestedAction: string;
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

export type AudienceData = {
  ageGroups: { label: string; percentage: number }[];
  gender: { label: string; value: number; color: string }[];
  countries: { country: string; code: string; percentage: number }[];
  cities: { city: string; country: string; percentage: number }[];
  peakHours: { hour: string; activity: number }[];
  interests: { category: string; percentage: number }[];
};

export type Competitor = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  platform: Platform;
  followers: number;
  followersGrowth: number;
  engagementRate: number;
  postsPerWeek: number;
  avgLikes: number;
  avgComments: number;
  avgViews: number; // Avg Views
  topContentType: string;
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
