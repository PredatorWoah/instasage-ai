import { prisma } from '@/lib/prisma';
import type { TimeSeriesPoint } from '@/types';

const dayKey = (d: Date) => d.toISOString().split('T')[0];

export async function getDashboardData(userId: string, days = 30) {
  const profiles = await prisma.socialProfile.findMany({ where: { userId } });
  const profileIds = profiles.map(p => p.id);

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [posts, windowPosts, viewTotals, metrics] = await Promise.all([
    prisma.post.findMany({
      where: { socialProfileId: { in: profileIds } },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    }),
    prisma.post.findMany({
      where: { socialProfileId: { in: profileIds }, publishedAt: { gte: since } },
      select: { publishedAt: true, performanceScore: true },
    }),
    prisma.post.aggregate({ where: { socialProfileId: { in: profileIds } }, _sum: { views: true } }),
    prisma.metric.findMany({
      where: { socialProfileId: { in: profileIds }, date: { gte: since } },
      orderBy: { date: 'asc' },
    }),
  ]);

  // Latest snapshot per profile per day, so repeated syncs don't double count
  type Snapshot = { followers: number | null; views: number | null; reach: number | null };
  const snapshots = new Map<string, Map<string, Snapshot>>();
  for (const m of metrics) {
    const byDay = snapshots.get(m.socialProfileId) ?? new Map();
    byDay.set(dayKey(m.date), { followers: m.followers, views: m.views, reach: m.reach });
    snapshots.set(m.socialProfileId, byDay);
  }

  const postsByDay = new Map<string, number[]>();
  for (const p of windowPosts) {
    const key = dayKey(p.publishedAt);
    postsByDay.set(key, [...(postsByDay.get(key) ?? []), p.performanceScore]);
  }

  // Carry each profile's last known value forward; days before any sync stay empty
  const lastKnown = new Map<string, Snapshot>();
  const timeSeries: TimeSeriesPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = dayKey(d);

    for (const [profileId, byDay] of snapshots) {
      const snap = byDay.get(key);
      if (snap) lastKnown.set(profileId, snap);
    }
    const known = [...lastKnown.values()];
    const sum = (field: 'followers' | 'views' | 'reach') => {
      const values = known.map(k => k[field]).filter((v): v is number => v != null);
      return values.length ? values.reduce((a, b) => a + b, 0) : undefined;
    };
    const scores = postsByDay.get(key) ?? [];

    timeSeries.push({
      date: key,
      followers: sum('followers'),
      views: sum('views'),
      reach: sum('reach'),
      engagement: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : undefined,
      posts: scores.length,
    });
  }

  const firstFollowers = timeSeries.find(p => p.followers !== undefined)?.followers;
  const lastFollowers = [...timeSeries].reverse().find(p => p.followers !== undefined)?.followers;

  const totalFollowers = profiles.reduce((sum, p) => sum + p.followerCount, 0);
  const avgEngagement = windowPosts.length > 0
    ? windowPosts.reduce((sum, p) => sum + p.performanceScore, 0) / windowPosts.length
    : 0;

  return {
    profiles,
    posts,
    timeSeries,
    kpis: {
      followers: totalFollowers,
      followersChange: firstFollowers !== undefined && lastFollowers !== undefined ? lastFollowers - firstFollowers : 0,
      followersStart: firstFollowers ?? 0,
      views: viewTotals._sum.views ?? 0,
      engagement: avgEngagement,
    },
  };
}
