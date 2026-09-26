import { prisma } from '@/lib/prisma';
import { WEEKDAYS, groupStat, localParts, postSummary, type GroupStat } from '@/services/analysis';

// Month by month numbers for the Reports page and its PDF, in the creator's timezone

export type MonthKpis = {
  posts: number;
  views: number;
  reach: number | null;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  engagement: number;
  followersStart: number | null;
  followersEnd: number | null;
  followersGained: number | null;
};

export type MonthlyReport = Awaited<ReturnType<typeof getMonthlyReport>>;

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const previousMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};
const daysIn = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export async function getMonthlyReport(profileIds: string[], timeZone: string, requested?: string | null) {
  const [profiles, posts, metrics] = await Promise.all([
    prisma.socialProfile.findMany({ where: { id: { in: profileIds } }, select: { id: true, platform: true, username: true, followerCount: true } }),
    prisma.post.findMany({ where: { socialProfileId: { in: profileIds } }, orderBy: { publishedAt: 'desc' } }),
    prisma.metric.findMany({ where: { socialProfileId: { in: profileIds } }, orderBy: { date: 'asc' } }),
  ]);

  const monthOf = new Map(posts.map((p) => [p.id, localParts(p.publishedAt, timeZone)]));
  const current = localParts(new Date(), timeZone).monthKey;
  const months = [...new Set([current, ...[...monthOf.values()].map((l) => l.monthKey), ...metrics.map((m) => m.date.toISOString().slice(0, 7))])]
    .sort()
    .reverse();
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : current;

  const kpis = (key: string): MonthKpis => {
    const inMonth = posts.filter((p) => monthOf.get(p.id)!.monthKey === key);
    const monthMetrics = metrics.filter((m) => m.date.toISOString().startsWith(key));
    // Followers: first and last snapshot of each account inside the month
    let start: number | null = null;
    let end: number | null = null;
    for (const profile of profiles) {
      const snaps = monthMetrics.filter((m) => m.socialProfileId === profile.id && m.followers != null);
      if (!snaps.length) continue;
      start = (start ?? 0) + snaps[0].followers!;
      end = (end ?? 0) + snaps.at(-1)!.followers!;
    }
    const reachRows = monthMetrics.filter((m) => m.reach != null);
    const sum = (pick: (p: (typeof posts)[number]) => number) => inMonth.reduce((a, p) => a + pick(p), 0);
    return {
      posts: inMonth.length,
      views: sum((p) => p.views),
      reach: reachRows.length ? reachRows.reduce((a, m) => a + (m.reach ?? 0), 0) : null,
      likes: sum((p) => p.likes),
      comments: sum((p) => p.comments),
      saves: sum((p) => p.saves),
      shares: sum((p) => p.shares),
      engagement: inMonth.length ? Number((sum((p) => p.performanceScore) / inMonth.length).toFixed(2)) : 0,
      followersStart: start,
      followersEnd: end,
      followersGained: start != null && end != null ? end - start : null,
    };
  };

  const monthPosts = posts.filter((p) => monthOf.get(p.id)!.monthKey === month);
  const baseline = monthPosts.length ? monthPosts.reduce((a, p) => a + p.views, 0) / monthPosts.length : 0;
  const group = (key: (p: (typeof posts)[number]) => string, order?: string[]) => {
    const map = new Map<string, typeof posts>();
    for (const p of monthPosts) map.set(key(p), [...(map.get(key(p)) ?? []), p]);
    const stats: GroupStat[] = [...map].map(([label, rows]) => groupStat(label, rows, baseline));
    return order ? stats.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : stats.sort((a, b) => b.avgViews - a.avgViews);
  };

  // Day by day inside the month
  const days = Array.from({ length: daysIn(month) }, (_, i) => {
    const key = `${month}-${String(i + 1).padStart(2, '0')}`;
    const dayPosts = monthPosts.filter((p) => monthOf.get(p.id)!.dayKey === key);
    const dayMetrics = metrics.filter((m) => m.date.toISOString().startsWith(key));
    const followers = profiles.map((pr) => dayMetrics.filter((m) => m.socialProfileId === pr.id && m.followers != null).at(-1)?.followers);
    return {
      date: key,
      posts: dayPosts.length,
      views: dayPosts.reduce((a, p) => a + p.views, 0),
      reach: dayMetrics.some((m) => m.reach != null) ? dayMetrics.reduce((a, m) => a + (m.reach ?? 0), 0) : null,
      followers: followers.some((f) => f != null) ? followers.reduce<number>((a, f) => a + (f ?? 0), 0) : null,
    };
  });

  const byViews = [...monthPosts].sort((a, b) => b.views - a.views);
  return {
    month,
    label: monthLabel(month),
    timeZone,
    months: months.map((key) => ({ key, label: monthLabel(key) })),
    accounts: profiles.map((p) => ({ platform: p.platform, username: p.username, followers: p.followerCount })),
    kpis: kpis(month),
    previous: { month: previousMonth(month), label: monthLabel(previousMonth(month)), kpis: kpis(previousMonth(month)) },
    byFormat: group((p) => p.type),
    byWeekday: group((p) => WEEKDAYS[monthOf.get(p.id)!.weekday], WEEKDAYS),
    days,
    topPosts: byViews.slice(0, 5).map((p) => postSummary(p, timeZone)),
    weakestPosts: byViews.length > 5 ? byViews.slice(-3).reverse().map((p) => postSummary(p, timeZone)) : [],
  };
}

// Compact text version for the AI's month review
export function reportToPrompt(r: MonthlyReport) {
  const k = (x: MonthKpis) =>
    `${x.posts} posts, ${x.views} views on posts published, reach ${x.reach ?? 'unknown'}, ${x.likes} likes, ${x.comments} comments, ${x.saves} saves, ${x.shares} shares, avg engagement ${x.engagement}%, followers ${x.followersStart ?? '?'} to ${x.followersEnd ?? '?'} (${x.followersGained == null ? 'unknown change' : `${x.followersGained >= 0 ? '+' : ''}${x.followersGained}`})`;
  const g = (s: GroupStat) => `${s.label}: ${s.posts} posts, avg ${s.avgViews} views, ${s.avgEngagement}% eng`;
  const p = (x: MonthlyReport['topPosts'][number]) => `[${x.type}, ${x.postedLocal}] ${x.views} views, ${x.saves} saves, ${x.shares} shares, ${x.engagement}% eng | "${x.caption}"`;
  return [
    `Monthly report for ${r.label}. Accounts: ${r.accounts.map((a) => `${a.platform} @${a.username}`).join(', ')}. Timezone ${r.timeZone}; times are local, never mention UTC.`,
    `This month: ${k(r.kpis)}`,
    `Previous month (${r.previous.label}): ${k(r.previous.kpis)}`,
    `By format: ${r.byFormat.map(g).join('; ') || 'none'}`,
    `By weekday: ${r.byWeekday.map(g).join('; ') || 'none'}`,
    `Top posts:\n${r.topPosts.map(p).join('\n') || 'none'}`,
    r.weakestPosts.length ? `Weakest posts:\n${r.weakestPosts.map(p).join('\n')}` : '',
  ].filter(Boolean).join('\n');
}
