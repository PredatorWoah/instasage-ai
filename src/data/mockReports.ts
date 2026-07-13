import type { Report } from '@/types';
import { mockPosts } from './mockPosts';

export const mockReports: Report[] = [
  {
    id: 'june-2024',
    month: 'June',
    year: 2024,
    summary: {
      totalFollowersGained: 14200,
      totalReach: 3_200_000,
      totalViews: 8_900_000,
      avgEngagementRate: 6.8,
    },
    bestPost: mockPosts[4],
    worstPost: mockPosts[9],
  },
  {
    id: 'may-2024',
    month: 'May',
    year: 2024,
    summary: {
      totalFollowersGained: 9800,
      totalReach: 2_600_000,
      totalViews: 6_700_000,
      avgEngagementRate: 5.6,
    },
    bestPost: mockPosts[1],
    worstPost: mockPosts[6],
  },
  {
    id: 'april-2024',
    month: 'April',
    year: 2024,
    summary: {
      totalFollowersGained: 7400,
      totalReach: 2_100_000,
      totalViews: 5_200_000,
      avgEngagementRate: 5.1,
    },
    bestPost: mockPosts[7],
    worstPost: mockPosts[9],
  },
];
