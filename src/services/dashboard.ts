import { prisma } from '@/lib/prisma';
import type { TimeSeriesPoint } from '@/types';
import type { AccountScope } from '@/lib/scope';
import { localParts } from '@/services/analysis';

const dayKey = (d: Date) => d.toISOString().split('T')[0];

// Stats for the accounts selected in the top bar switcher. Posts land on the day they went
// up in the creator's timezone; daily snapshots keep the day they were taken.
export async function getDashboardData(scope: AccountScope, days = 30, timeZone = 'UTC') {
  const postDay = (d: Date) => localParts(d, timeZone).dayKey;
  const { profiles, profileIds } = scope;

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [posts, windowPosts, viewTotals, organicAvg, metrics, topPosts] = await Promise.all([
    prisma.post.findMany({
      where: { socialProfileId: { in: profileIds } },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    }),
    prisma.post.findMany({
      where: { socialProfileId: { in: profileIds }, publishedAt: { gte: since } },
      select: { publishedAt: true, performanceScore: true, views: true, platform: true, reach: true, likes: true, comments: true, saves: true, shares: true, isBoosted: true },
    }),
    prisma.post.aggregate({ where: { socialProfileId: { in: profileIds } }, _sum: { views: true } }),
    prisma.post.aggregate({ where: { socialProfileId: { in: profileIds }, isBoosted: false }, _avg: { views: true } }),
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
    const key = postDay(p.publishedAt);
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
    let channelViews: number | undefined;
    for (const [profileId, byDay] of snapshots) {
      const snap = byDay.get(key);
      if (snap) {
        // YouTube snapshots carry lifetime channel views; the change since the last one is views gained
        const before = lastKnown.get(profileId)?.views;
        if (snap.views != null && before != null && snap.views >= before) channelViews = (channelViews ?? 0) + (snap.views - before);
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
      channelViews,
    });
  }

  const firstFollowers = timeSeries.find(p => p.followers !== undefined)?.followers;
  const lastFollowers = [...timeSeries].reverse().find(p => p.followers !== undefined)?.followers;

  const totalFollowers = profiles.reduce((sum, p) => sum + p.followerCount, 0);
  // Total interactions over total reach (views for YouTube), so one tiny post can't swing the
  // number the way an average of per-post percentages does. Boosted posts only report organic stats.
  let interactions = 0;
  let audienceSize = 0;
  let counted = 0;
  for (const p of windowPosts) {
    if (p.isBoosted) continue;
    if (p.platform === 'youtube') {
      interactions += p.likes + p.comments;
      audienceSize += p.views;
    } else if (p.reach) {
      interactions += p.likes + p.comments + p.saves + p.shares;
      audienceSize += p.reach;
    } else continue;
    counted += 1;
  }
  const avgEngagement = audienceSize > 0 ? (interactions / audienceSize) * 100 : 0;

  // Unique accounts reached in the last 30 days, straight from Instagram (null until the next sync)
  const instagram = profiles.filter((p) => p.platform === 'instagram');
  const reach30 = instagram.length && instagram.every((p) => p.reach30 != null) ? instagram.reduce((a, p) => a + (p.reach30 ?? 0), 0) : null;

  const now = Date.now();
  const latestPosts = posts.slice(0, 4).map((p) => ({ ...p, ageDays: (now - p.publishedAt.getTime()) / 86_400_000 }));

  // Oldest sync among connected accounts: a disconnected one can't sync, so it shouldn't make everything look stale
  const syncing = profiles.filter((p) => p.isConnected);
  const lastSynced = syncing.length ? Math.min(...syncing.map((p) => p.lastSyncedAt.getTime())) : null;

  return {
    profiles,
    posts,
    latestPosts,
    syncedMinutesAgo: lastSynced == null ? null : (now - lastSynced) / 60_000,
    topPosts,
    timeSeries,
    kpis: {
      followers: totalFollowers,
      followersChange: firstFollowers !== undefined && lastFollowers !== undefined ? lastFollowers - firstFollowers : 0,
      followersStart: firstFollowers ?? 0,
      views: viewTotals._sum.views ?? 0,
      engagement: avgEngagement,
      engagementPosts: counted,
      avgViews: Math.round(organicAvg._avg.views ?? 0),
      reach30,
      channelViews: timeSeries.some((p) => p.channelViews !== undefined) ? timeSeries.reduce((a, p) => a + (p.channelViews ?? 0), 0) : null,
    },
  };
}

export type PeriodTotals = { posts: number; views: number; engagement: number | null; reach: number | null; followersGained: number | null };

// The last `days` against the `days` before them, for the "vs previous period" row on Analytics
export async function comparePeriods(scope: AccountScope, days: number): Promise<{ current: PeriodTotals; previous: PeriodTotals }> {
  const { profileIds } = scope;
  const now = Date.now();
  const start = new Date(now - days * 86_400_000);
  const prevStart = new Date(now - 2 * days * 86_400_000);
  const [posts, metrics] = await Promise.all([
    prisma.post.findMany({
      where: { socialProfileId: { in: profileIds }, publishedAt: { gte: prevStart } },
      select: { publishedAt: true, views: true, performanceScore: true },
    }),
    prisma.metric.findMany({
      where: { socialProfileId: { in: profileIds }, date: { gte: new Date(prevStart.getTime() - 3 * 86_400_000) } },
      orderBy: { date: 'asc' },
      select: { socialProfileId: true, date: true, followers: true, reach: true },
    }),
  ]);

  // Latest snapshot per profile per day, so repeated syncs don't double count
  const daily = new Map<string, { profile: string; date: Date; followers: number | null; reach: number | null }>();
  for (const m of metrics) daily.set(`${m.socialProfileId}:${dayKey(m.date)}`, { profile: m.socialProfileId, date: m.date, followers: m.followers, reach: m.reach });
  const rows = [...daily.values()];

  // Followers at a moment: each profile's last known count at or before it
  const followersAt = (t: Date) => {
    let total = 0;
    for (const id of profileIds) {
      const last = rows.filter((r) => r.profile === id && r.followers != null && r.date <= t).at(-1);
      if (!last) return null;
      total += last.followers!;
    }
    return total;
  };

  const totals = (from: Date, to: Date): PeriodTotals => {
    const inside = posts.filter((p) => p.publishedAt >= from && p.publishedAt < to);
    const reachRows = rows.filter((r) => r.reach != null && r.date >= from && r.date < to);
    const begin = followersAt(from);
    const end = followersAt(to);
    return {
      posts: inside.length,
      views: inside.reduce((a, p) => a + p.views, 0),
      engagement: inside.length ? inside.reduce((a, p) => a + p.performanceScore, 0) / inside.length : null,
      // Only count reach when most days of the window have it (Instagram keeps 30 days)
      reach: reachRows.length >= days * 0.6 ? reachRows.reduce((a, r) => a + r.reach!, 0) : null,
      followersGained: begin != null && end != null ? end - begin : null,
    };
  };
  return { current: totals(start, new Date(now + 60_000)), previous: totals(prevStart, start) };
}
