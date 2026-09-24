import type { TimeSeriesPoint } from '@/types';

function generateDates(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date('2024-06-30');
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().split('T')[0];
  });
}

// Generate 365 points for one year of time series data
const dates = generateDates(365);

export const mockFollowersTimeSeries: TimeSeriesPoint[] = dates.map((date, i) => ({
  date,
  followers: 1_100_000 + Math.floor(i * 980 + (i % 3) * 500),
}));

export const mockViewsTimeSeries: TimeSeriesPoint[] = dates.map((date, i) => ({
  date,
  views: 100_000 + Math.floor(i * 1800 + (i % 5) * 22_000 - (i % 2) * 8_000),
}));

export const mockEngagementTimeSeries: TimeSeriesPoint[] = dates.map((date, i) => ({
  date,
  engagement: parseFloat((4.5 + Math.sin(i / 15) * 1.5 + (i % 3) * 0.15).toFixed(2)),
}));

export const mockReachTimeSeries: TimeSeriesPoint[] = dates.map((date, i) => ({
  date,
  reach: 50_000 + Math.floor(i * 680 + (i % 4) * 8_000),
}));

export const mockPostingFrequency: TimeSeriesPoint[] = dates.map((date, i) => ({
  date,
  posts: (i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : i % 2 === 0 ? 1 : 0),
}));
