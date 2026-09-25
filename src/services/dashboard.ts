import { prisma } from '@/lib/prisma';
import type { TimeSeriesPoint } from '@/types';
import type { AccountScope } from '@/lib/scope';

const dayKey = (d: Date) => d.toISOString().split('T')[0];

// Stats for the accounts selected in the top bar switcher
export async function getDashboardData(scope: AccountScope, days = 30) {
  const { profiles, profileIds } = scope;

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [posts, windowPosts, viewTotals, metrics, topPosts] = await Promise.all([
    prisma.post.findMany({
      where: { socialProfileId: { in: profileIds } },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    }),
    prisma.post.findMany({
      where: { socialProfileId: { in: profileIds }, publishedAt: { gte: since } },
      select: { publishedAt: true, performanceScore: true, views: true },
    }),
    prisma.post.aggregate({ where: { socialProfileId: { in: profileIds } }, _sum: { views: true } }),
    prisma.metric.findMany({
      where: { socialProfileId: { in: profileIds }, date: { gte: since } },
      orderBy: { date: 'asc' },
    }),
    prisma.post.findMany({
      where: { socialProfileId: { in: profileIds } },
      orderBy: { performanceScore: 'desc' },
      take: 5,
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

  const postsByDay = new Map<string, { score: number; views: number }[]>();
  for (const p of windowPosts) {
    const key = dayKey(p.publishedAt);
    postsByDay.set(key, [...(postsByDay.get(key) ?? []), { score: p.performanceScore, views: p.views }]);
  }

  // Carry each profile's last known value forward; days before any sync stay empty
  const lastKnown = new Map<string, Snapshot>();
  const timeSeries: TimeSeriesPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = dayKey(d);

    const today: Snapshot[] = [];
    for (const [profileId, byDay] of snapshots) {
      const snap = byDay.get(key);
      if (snap) {
        lastKnown.set(profileId, snap);
        today.push(snap);
      }
    }
    const sum = (rows: Snapshot[], field: 'followers' | 'reach') => {
      const values = rows.map(k => k[field]).filter((v): v is number => v != null);
      return values.length ? values.reduce((a, b) => a + b, 0) : undefined;
    };
    const dayPosts = postsByDay.get(key) ?? [];

    timeSeries.push({
      date: key,
      // Follower totals carry forward between syncs; reach is a per-day figure, so it doesn't
      followers: sum([...lastKnown.values()], 'followers'),
      reach: sum(today, 'reach'),
      // Views of the posts published that day (their lifetime views so far)
      views: dayPosts.length ? dayPosts.reduce((a, p) => a + p.views, 0) : undefined,
      engagement: dayPosts.length ? Number((dayPosts.reduce((a, p) => a + p.score, 0) / dayPosts.length).toFixed(2)) : undefined,
      posts: dayPosts.length,
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
    topPosts,
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
