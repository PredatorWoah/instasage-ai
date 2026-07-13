/**
 * API Service Layer
 * All functions currently return mock data.
 * Replace imports and return values with real fetch/axios calls when integrating a backend.
 */
import type {
  Post, Insight, Recommendation, AudienceData,
  Competitor, Report, KPIMetric, TimeSeriesPoint,
} from '@/types';
import { mockKPIs, mockFollowersTimeSeries, mockViewsTimeSeries, mockEngagementTimeSeries, mockReachTimeSeries, mockPostingFrequency } from '@/data/mockMetrics';
import { mockPosts } from '@/data/mockPosts';
import { mockInsights } from '@/data/mockInsights';
import { mockRecommendations } from '@/data/mockRecommendations';
import { mockAudienceData } from '@/data/mockAudience';
import { mockCompetitors } from '@/data/mockCompetitors';
import { mockReports } from '@/data/mockReports';

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchKPIs(): Promise<KPIMetric[]> {
  await delay();
  return mockKPIs;
}

export async function fetchFollowersTimeSeries(): Promise<TimeSeriesPoint[]> {
  await delay();
  return mockFollowersTimeSeries;
}

export async function fetchViewsTimeSeries(): Promise<TimeSeriesPoint[]> {
  await delay();
  return mockViewsTimeSeries;
}

export async function fetchEngagementTimeSeries(): Promise<TimeSeriesPoint[]> {
  await delay();
  return mockEngagementTimeSeries;
}

export async function fetchReachTimeSeries(): Promise<TimeSeriesPoint[]> {
  await delay();
  return mockReachTimeSeries;
}

export async function fetchPostingFrequency(): Promise<TimeSeriesPoint[]> {
  await delay();
  return mockPostingFrequency;
}

export async function fetchRecentPosts(limit = 8): Promise<Post[]> {
  await delay();
  return mockPosts.slice(0, limit);
}

export async function fetchAllPosts(): Promise<Post[]> {
  await delay();
  return mockPosts;
}

export async function fetchInsights(): Promise<Insight[]> {
  await delay();
  return mockInsights;
}

export async function fetchRecommendations(): Promise<Recommendation[]> {
  await delay();
  return mockRecommendations;
}

export async function fetchAudienceData(): Promise<AudienceData> {
  await delay();
  return mockAudienceData;
}

export async function fetchCompetitors(): Promise<Competitor[]> {
  await delay();
  return mockCompetitors;
}

export async function fetchReports(): Promise<Report[]> {
  await delay();
  return mockReports;
}
