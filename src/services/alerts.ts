import { prisma } from '@/lib/prisma';
import type { CompetitorPost, CompetitorStats } from '@/services/competitors';

export type Alert = {
  id: string; // stable, so a dismissed alert stays dismissed
  kind: 'outperforming' | 'cadence' | 'milestone' | 'follower_drop' | 'rival_viral';
  tone: 'good' | 'warn' | 'info';
  title: string;
  body: string;
  href?: string;
  at: string;
};

const DAY = 86_400_000;

// Round numbers worth celebrating, scaled to the account's size
const milestoneStep = (n: number) => (n < 1000 ? 100 : n < 5000 ? 500 : n < 20000 ? 1000 : n < 100000 ? 5000 : 10000);

// Things worth knowing right now, worked out from synced data (no extra API calls)
export async function computeAlerts(userId: string): Promise<Alert[]> {
  const now = Date.now();
  const [user, profiles, competitors] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { dismissedAlerts: true } }),
    prisma.socialProfile.findMany({ where: { userId } }),
    prisma.competitor.findMany({ where: { userId, error: null } }),
  ]);
  const dismissed = new Set((user?.dismissedAlerts as string[] | null) ?? []);
  const alerts: Alert[] = [];

  for (const p of profiles) {
    const unit = p.platform === 'youtube' ? 'subscribers' : 'followers';
    const thing = p.platform === 'youtube' ? 'video' : 'post';
    const [avg, recent, lastPosts, metrics] = await Promise.all([
      prisma.post.aggregate({ where: { socialProfileId: p.id, isBoosted: false }, _avg: { views: true } }),
      prisma.post.findMany({ where: { socialProfileId: p.id, isBoosted: false, publishedAt: { gte: new Date(now - 3 * DAY) } } }),
      prisma.post.findMany({ where: { socialProfileId: p.id }, orderBy: { publishedAt: 'desc' }, take: 11, select: { id: true, publishedAt: true } }),
      prisma.metric.findMany({ where: { socialProfileId: p.id, date: { gte: new Date(now - 8 * DAY) }, followers: { not: null } }, orderBy: { date: 'asc' }, select: { date: true, followers: true } }),
    ]);

    // A fresh post running well ahead of the account's usual views
    const base = avg._avg.views ?? 0;
    for (const post of recent) {
      if (base <= 0 || post.views < 100 || post.views < base * 2) continue;
      const hours = Math.max(1, Math.round((now - post.publishedAt.getTime()) / 3_600_000));
      alerts.push({
        id: `out:${post.id}`,
        kind: 'outperforming',
        tone: 'good',
        title: `@${p.username}: a ${post.type} is at ${(post.views / base).toFixed(1)}x your usual views`,
        body: `${post.views.toLocaleString()} views ${hours}h after posting. Reply to comments now and share it to your Story while it is hot.`,
        href: `/content/${encodeURIComponent(post.id)}`,
        at: post.publishedAt.toISOString(),
      });
    }

    // A gap well beyond the usual rhythm
    if (lastPosts.length >= 4) {
      const gaps = lastPosts.slice(1).map((x, i) => (lastPosts[i].publishedAt.getTime() - x.publishedAt.getTime()) / DAY);
      const usual = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const since = (now - lastPosts[0].publishedAt.getTime()) / DAY;
      if (since > Math.max(4, usual * 2)) {
        alerts.push({
          id: `cad:${p.id}:${lastPosts[0].id}`,
          kind: 'cadence',
          tone: 'warn',
          title: `@${p.username}: ${Math.floor(since)} days since your last ${thing}`,
          body: `You usually post every ${usual < 1.5 ? 'day or so' : `${usual.toFixed(1)} days`}. Long gaps tend to cost reach on the next ${thing}. Your idea board has drafts ready.`,
          href: '/recommendations?tab=board',
          at: new Date(lastPosts[0].publishedAt.getTime() + usual * 2 * DAY).toISOString(),
        });
      }
    }

    // Crossing a round number, or a noticeable drop over the week
    if (metrics.length >= 2) {
      const first = metrics[0].followers!;
      const last = p.followerCount || metrics.at(-1)!.followers!;
      const step = milestoneStep(last);
      const before = metrics.find((m) => now - m.date.getTime() <= 3 * DAY)?.followers ?? first;
      if (Math.floor(last / step) > Math.floor(before / step)) {
        const mark = Math.floor(last / step) * step;
        alerts.push({ id: `mile:${p.id}:${mark}`, kind: 'milestone', tone: 'good', title: `@${p.username} passed ${mark.toLocaleString()} ${unit}`, body: `Now at ${last.toLocaleString()}. A thank-you post or Story tends to do well right after a milestone.`, href: '/', at: new Date().toISOString() });
      }
      const change = last - first;
      if (change < 0 && -change >= Math.max(5, first * 0.01)) {
        const week = new Date(now).toISOString().slice(0, 10);
        alerts.push({ id: `drop:${p.id}:${week}`, kind: 'follower_drop', tone: 'warn', title: `@${p.username} lost ${Math.abs(change).toLocaleString()} ${unit} this week`, body: 'Check the Latest posts section: an off-topic post or a long gap is the usual cause. Clean-ups of inactive accounts by the platform also show up like this.', href: '/analytics', at: new Date().toISOString() });
      }
    }
  }

  // A competitor post taking off
  for (const c of competitors) {
    const stats = c.stats as CompetitorStats | null;
    const avgLikes = stats?.avgLikes;
    if (!avgLikes) continue;
    for (const post of (c.posts as CompetitorPost[] | null) ?? []) {
      if (post.likes == null || post.likes < 50 || post.likes < avgLikes * 3) continue;
      if (now - Date.parse(post.timestamp) > 7 * DAY) continue;
      alerts.push({
        id: `rival:${post.id}`,
        kind: 'rival_viral',
        tone: 'info',
        title: `@${c.username} has a ${post.type} at ${(post.likes / avgLikes).toFixed(1)}x their usual likes`,
        body: `"${post.caption.replace(/\s+/g, ' ').slice(0, 90)}" Worth a look for what made it land.`,
        href: '/competitors',
        at: post.timestamp,
      });
    }
  }

  return alerts.filter((a) => !dismissed.has(a.id)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 20);
}

export async function dismissAlerts(userId: string, ids: string[]) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { dismissedAlerts: true } });
  const list = [...new Set([...(((user?.dismissedAlerts as string[] | null) ?? [])), ...ids])].slice(-300);
  await prisma.user.update({ where: { id: userId }, data: { dismissedAlerts: list } });
}
