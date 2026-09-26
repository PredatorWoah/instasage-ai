import { prisma } from '@/lib/prisma';

// Real numbers worked out before any AI sees them: patterns by format, day, hour, caption
// style and hashtags, momentum and cadence. The AI reasons over these instead of guessing
// from raw rows, and the Reports page uses the same maths.

type PostRow = Awaited<ReturnType<typeof prisma.post.findMany>>[number];

export type GroupStat = {
  label: string;
  posts: number;
  avgViews: number;
  avgEngagement: number;
  avgSaves: number;
  avgShares: number;
  avgComments: number;
  viewsLift: number; // % vs the account's overall average
};

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS = [
  { label: 'Late night (12-6 AM)', from: 0, to: 5 },
  { label: 'Morning (6-11 AM)', from: 6, to: 11 },
  { label: 'Afternoon (12-4 PM)', from: 12, to: 16 },
  { label: 'Evening (5-8 PM)', from: 17, to: 20 },
  { label: 'Night (9-11 PM)', from: 21, to: 23 },
];

// Wall-clock parts of a date in the creator's timezone
export function localParts(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    weekday: WEEKDAYS.indexOf(get('weekday')),
    dayKey: `${get('year')}-${get('month')}-${get('day')}`,
    monthKey: `${get('year')}-${get('month')}`,
  };
}

export const hour12 = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

export function localTime(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (n: number, dp = 0) => Number(n.toFixed(dp));

export function groupStat(label: string, posts: PostRow[], baselineViews: number): GroupStat {
  const avgViews = mean(posts.map((p) => p.views));
  return {
    label,
    posts: posts.length,
    avgViews: round(avgViews),
    avgEngagement: round(mean(posts.map((p) => p.performanceScore)), 2),
    avgSaves: round(mean(posts.map((p) => p.saves)), 1),
    avgShares: round(mean(posts.map((p) => p.shares)), 1),
    avgComments: round(mean(posts.map((p) => p.comments)), 1),
    viewsLift: baselineViews ? round(((avgViews - baselineViews) / baselineViews) * 100) : 0,
  };
}

function groupBy(posts: PostRow[], key: (p: PostRow) => string | null, baseline: number, order?: string[]) {
  const groups = new Map<string, PostRow[]>();
  for (const p of posts) {
    const k = key(p);
    if (k == null) continue;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  const stats = [...groups].map(([label, rows]) => groupStat(label, rows, baseline));
  return order ? stats.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : stats.sort((a, b) => b.posts - a.posts);
}

const HASHTAG = /#[\p{L}\p{N}_]+/gu;
const CTA = /\b(comment|save|share|follow|tag|link in bio|dm|subscribe|let me know|tell me)\b/i;

export function captionLength(caption: string) {
  const n = caption.replace(HASHTAG, '').trim().length;
  return n < 60 ? 'Short (under 60 chars)' : n < 250 ? 'Medium (60-250 chars)' : 'Long (250+ chars)';
}

export function postSummary(p: PostRow, timeZone: string) {
  return {
    id: p.id,
    type: p.type,
    postedAt: p.publishedAt.toISOString(),
    postedLocal: localTime(p.publishedAt, timeZone),
    caption: p.caption.replace(/\s+/g, ' ').slice(0, 120),
    thumbnail: p.thumbnail,
    permalink: p.permalink,
    views: p.views,
    reach: p.reach,
    likes: p.likes,
    comments: p.comments,
    saves: p.saves,
    shares: p.shares,
    engagement: round(p.performanceScore, 2),
    isBoosted: p.isBoosted,
  };
}

export type Analysis = Awaited<ReturnType<typeof buildAnalysis>>;

export async function buildAnalysis(profileIds: string[], timeZone: string) {
  const [profiles, allPosts, metrics] = await Promise.all([
    prisma.socialProfile.findMany({ where: { id: { in: profileIds } } }),
    prisma.post.findMany({ where: { socialProfileId: { in: profileIds } }, orderBy: { publishedAt: 'desc' }, take: 300 }),
    prisma.metric.findMany({
      where: { socialProfileId: { in: profileIds }, date: { gte: new Date(Date.now() - 45 * 86400_000) } },
      orderBy: { date: 'asc' },
    }),
  ]);

  // Boosted posts only report organic numbers, which would drag every pattern down
  const posts = allPosts.filter((p) => !p.isBoosted);
  const baseline = mean(posts.map((p) => p.views));
  const local = new Map(posts.map((p) => [p.id, localParts(p.publishedAt, timeZone)]));

  const byFormat = groupBy(posts, (p) => p.type, baseline);
  const byWeekday = groupBy(posts, (p) => WEEKDAYS[local.get(p.id)!.weekday], baseline, WEEKDAYS);
  const slotOf = (h: number) => SLOTS.find((s) => h >= s.from && h <= s.to)!.label;
  const bySlot = groupBy(posts, (p) => slotOf(local.get(p.id)!.hour), baseline, SLOTS.map((s) => s.label));
  const byHour = groupBy(posts, (p) => hour12(local.get(p.id)!.hour), baseline)
    .filter((g) => g.posts >= 2)
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 5);
  const byCaption = groupBy(posts, (p) => captionLength(p.caption), baseline);
  const byHashtags = groupBy(posts, (p) => {
    const n = p.caption.match(HASHTAG)?.length ?? 0;
    return n === 0 ? 'No hashtags' : n <= 5 ? '1-5 hashtags' : '6+ hashtags';
  }, baseline);
  const byHook = groupBy(posts, (p) => (/\?/.test(p.caption.split('\n')[0]) ? 'Opens with a question' : 'Opens with a statement'), baseline);
  const byCta = groupBy(posts, (p) => (CTA.test(p.caption) ? 'Has a call to action' : 'No call to action'), baseline);

  // Hashtags used at least twice, ranked by the views of the posts carrying them
  const tagPosts = new Map<string, PostRow[]>();
  for (const p of posts) {
    for (const tag of new Set((p.caption.match(HASHTAG) ?? []).map((t) => t.toLowerCase()))) {
      tagPosts.set(tag, [...(tagPosts.get(tag) ?? []), p]);
    }
  }
  const hashtags = [...tagPosts]
    .filter(([, rows]) => rows.length >= 2)
    .map(([tag, rows]) => groupStat(tag, rows, baseline))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 8);

  // Momentum: the last 10 posts against the 10 before them
  const recent = posts.slice(0, 10);
  const earlier = posts.slice(10, 20);
  const momentum = earlier.length >= 3 ? {
    recentViews: round(mean(recent.map((p) => p.views))),
    earlierViews: round(mean(earlier.map((p) => p.views))),
    recentEngagement: round(mean(recent.map((p) => p.performanceScore)), 2),
    earlierEngagement: round(mean(earlier.map((p) => p.performanceScore)), 2),
  } : null;

  // Cadence over the last 8 weeks
  const now = Date.now();
  const weeks = Array.from({ length: 8 }, (_, i) => allPosts.filter((p) => {
    const age = (now - p.publishedAt.getTime()) / 86400_000;
    return age >= i * 7 && age < (i + 1) * 7;
  }).length).reverse();
  const gaps = allPosts.slice(0, 30).slice(1).map((p, i) => (allPosts[i].publishedAt.getTime() - p.publishedAt.getTime()) / 86400_000);
  const daysSinceLast = allPosts[0] ? round((now - allPosts[0].publishedAt.getTime()) / 86400_000, 1) : null;

  // Followers over the last 30 days, from the daily snapshots
  const latestByProfile = new Map<string, { first: number | null; last: number | null }>();
  for (const m of metrics) {
    if (m.followers == null || now - m.date.getTime() > 31 * 86400_000) continue;
    const row = latestByProfile.get(m.socialProfileId) ?? { first: m.followers, last: m.followers };
    row.last = m.followers;
    latestByProfile.set(m.socialProfileId, row);
  }
  const followersNow = profiles.reduce((a, p) => a + p.followerCount, 0);
  // First vs last snapshot inside the window, so both ends come from the same source
  const snapshotChange = [...latestByProfile.values()].reduce((a, r) => a + ((r.last ?? 0) - (r.first ?? 0)), 0);
  const reach30 = metrics.filter((m) => now - m.date.getTime() <= 30 * 86400_000).reduce((a, m) => a + (m.reach ?? 0), 0);

  const byViews = [...posts].sort((a, b) => b.views - a.views);
  const audience = profiles.map((p) => p.audience as { age?: { label: string; value: number }[]; gender?: { label: string; value: number }[]; country?: { label: string; value: number }[]; city?: { label: string; value: number }[] } | null).find(Boolean) ?? null;

  return {
    timeZone,
    accounts: profiles.map((p) => ({ platform: p.platform, username: p.username, followers: p.followerCount })),
    totals: {
      posts: allPosts.length,
      organicPosts: posts.length,
      boostedPosts: allPosts.length - posts.length,
      avgViews: round(baseline),
      medianViews: round(median(posts.map((p) => p.views))),
      avgEngagement: round(mean(posts.map((p) => p.performanceScore)), 2),
      avgSaves: round(mean(posts.map((p) => p.saves)), 1),
      avgShares: round(mean(posts.map((p) => p.shares)), 1),
      firstPost: allPosts.at(-1)?.publishedAt.toISOString() ?? null,
    },
    followers: {
      now: followersNow,
      change30: latestByProfile.size ? snapshotChange : null,
      reach30: reach30 || null,
    },
    byFormat, byWeekday, bySlot, byHour, byCaption, byHashtags, byHook, byCta, hashtags,
    momentum,
    cadence: {
      postsPerWeek: weeks,
      avgGapDays: gaps.length ? round(mean(gaps), 1) : null,
      longestGapDays: gaps.length ? round(Math.max(...gaps), 1) : null,
      daysSinceLast,
    },
    top: byViews.slice(0, 5).map((p) => postSummary(p, timeZone)),
    bottom: byViews.slice(-5).reverse().map((p) => postSummary(p, timeZone)),
    recent: allPosts.slice(0, 15).map((p) => postSummary(p, timeZone)),
    audience: audience && {
      age: (audience.age ?? []).sort((a, b) => b.value - a.value).slice(0, 3).map((r) => r.label),
      gender: (audience.gender ?? []).sort((a, b) => b.value - a.value).map((r) => r.label),
      countries: (audience.country ?? []).sort((a, b) => b.value - a.value).slice(0, 3).map((r) => r.label),
      cities: (audience.city ?? []).sort((a, b) => b.value - a.value).slice(0, 3).map((r) => r.label),
    },
  };
}

// ---------- The same numbers as compact text for a prompt ----------

const fmtGroup = (g: GroupStat) =>
  `${g.label}: ${g.posts} posts, avg ${g.avgViews} views (${g.viewsLift >= 0 ? '+' : ''}${g.viewsLift}% vs avg), ${g.avgEngagement}% engagement, ${g.avgSaves} saves, ${g.avgShares} shares, ${g.avgComments} comments`;

const fmtPost = (p: ReturnType<typeof postSummary>) =>
  `[${p.type}, ${p.postedLocal}] ${p.views} views, ${p.likes} likes, ${p.comments} comments, ${p.saves} saves, ${p.shares} shares, ${p.engagement}% eng${p.isBoosted ? ', BOOSTED (organic numbers only)' : ''} | "${p.caption}"`;

export function analysisToPrompt(a: Analysis) {
  const section = (title: string, rows: string[]) => (rows.length ? `\n## ${title}\n${rows.join('\n')}` : '');
  const t = a.totals;
  return [
    `Creator's timezone: ${a.timeZone}. Every time below is already local. Talk about times in 12-hour format like "7 PM" and never mention UTC.`,
    section('Accounts', a.accounts.map((x) => `${x.platform} @${x.username}: ${x.followers} followers`)),
    section('Overall (organic posts)', [
      `${t.organicPosts} organic posts analyzed${t.boostedPosts ? ` (${t.boostedPosts} boosted posts left out of the patterns: their stats are organic only)` : ''}`,
      `Average views ${t.avgViews}, median ${t.medianViews}. Average engagement ${t.avgEngagement}%. Avg saves ${t.avgSaves}, avg shares ${t.avgShares}.`,
      a.followers.change30 != null ? `Followers: ${a.followers.now} now, ${a.followers.change30 >= 0 ? '+' : ''}${a.followers.change30} over the last 30 days.` : `Followers: ${a.followers.now}.`,
      a.followers.reach30 ? `Accounts reached, last 30 days (sum of daily reach): ${a.followers.reach30}.` : '',
    ].filter(Boolean)),
    section('By format', a.byFormat.map(fmtGroup)),
    section('By weekday posted', a.byWeekday.map(fmtGroup)),
    section('By time of day posted', a.bySlot.map(fmtGroup)),
    section('Best specific hours (2+ posts)', a.byHour.map(fmtGroup)),
    section('Caption length', a.byCaption.map(fmtGroup)),
    section('Hashtag count', a.byHashtags.map(fmtGroup)),
    section('Caption hook', a.byHook.map(fmtGroup)),
    section('Call to action', a.byCta.map(fmtGroup)),
    section('Hashtags used 2+ times, best first', a.hashtags.map(fmtGroup)),
    section('Momentum', a.momentum ? [
      `Last 10 posts: avg ${a.momentum.recentViews} views, ${a.momentum.recentEngagement}% engagement. The 10 before: avg ${a.momentum.earlierViews} views, ${a.momentum.earlierEngagement}% engagement.`,
    ] : []),
    section('Posting cadence', [
      `Posts per week, oldest to newest over 8 weeks: ${a.cadence.postsPerWeek.join(', ')}`,
      a.cadence.avgGapDays != null ? `Average gap between posts ${a.cadence.avgGapDays} days, longest ${a.cadence.longestGapDays} days, ${a.cadence.daysSinceLast} days since the last post.` : '',
    ].filter(Boolean)),
    section('Audience', a.audience ? [
      `Top ages ${a.audience.age.join(', ')}; gender split order ${a.audience.gender.join(', ')} (F women, M men, U unspecified); top countries ${a.audience.countries.join(', ')}; top cities ${a.audience.cities.join(', ')}`,
    ] : []),
    section('Top 5 posts by views', a.top.map(fmtPost)),
    section('Weakest 5 posts by views', a.bottom.map(fmtPost)),
    section('15 most recent posts, newest first', a.recent.map(fmtPost)),
  ].join('\n');
}
