import { prisma } from '@/lib/prisma';
import { accountVocab, hashtagsOf, tokens, type Vocab } from '@/services/vocab';
import { firstLine, hookLibrary, stylesOf, type HookLibrary } from '@/services/hooks';

// What a draft is expected to do, worked out before it is posted, and how that guess held up afterwards.
// The forecast is arithmetic on the account's own posts: the usual views for the format, nudged by the
// words, hashtags and hook style in the draft. Nudges are damped, because "posts with this word did
// better" is a pattern, not a promise.

export type Forecast = {
  views: number; // expected views
  low: number;
  high: number; // the range most of this account's posts of the format land in
  base: number; // the format's usual views, before the nudges
  basis: { label: string; effect: number }[]; // what moved the number, in percent
  posts: number; // posts the baseline comes from
  at: string;
};

export type Verdict = 'beat' | 'hit' | 'missed' | 'early' | 'late';
export type ScoreRow = {
  draftId: string;
  title: string;
  format: string;
  postId: string;
  postedAt: string;
  actual: number;
  predicted: Forecast | null;
  verdict: Verdict | null; // null when the draft was saved before forecasts existed
  error: number | null; // actual against expected, in percent
};
export type Scorecard = {
  rows: ScoreRow[];
  graded: number; // forecasts old enough to judge
  inRange: number;
  beat: number;
  missed: number;
  typicalError: number | null; // median distance between expected and actual, in percent
};

const TYPE_OF: Record<string, string[]> = { reel: ['reel'], carousel: ['carousel'], caption: ['post', 'carousel'] };
const SETTLE_MS = 3 * 86_400_000; // views keep climbing for the first days, so younger posts are not judged yet

const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export type ForecastInput = { format: string; body: string; hashtags: string };

export function forecastFrom(posts: { type: string; views: number }[], vocab: Vocab, hooks: HookLibrary, input: ForecastInput): Forecast | null {
  if (posts.length < 8 || !input.body.trim()) return null;
  const wanted = TYPE_OF[input.format] ?? [];
  const same = posts.filter((p) => wanted.includes(p.type));
  // The format's own history when there is enough of it, otherwise every post
  const pool = (same.length >= 4 ? same : posts).map((p) => p.views).sort((a, b) => a - b);
  const base = quantile(pool, 0.5);
  if (base <= 0) return null;

  const basis: Forecast['basis'] = [];
  const words = tokens(input.body);
  const terms = new Set([...words, ...words.slice(1).map((w, i) => `${words[i]} ${w}`)]);
  if (vocab.enough) {
    const hit = [...vocab.words.good, ...vocab.words.bad].filter((t) => terms.has(t.term));
    if (hit.length) {
      const effect = Math.round(clamp(mean(hit.map((t) => t.lift)) * 0.4, -25, 25));
      const good = hit.filter((t) => t.lift > 0).length;
      if (effect) basis.push({ label: `${good} proven and ${hit.length - good} weaker ${hit.length === 1 ? 'word' : 'words'} in the caption`, effect });
    }
    const tags = new Set([...hashtagsOf(input.hashtags), ...hashtagsOf(input.body)]);
    const tagHit = [...vocab.hashtags.good, ...vocab.hashtags.bad].filter((t) => tags.has(t.term));
    if (tagHit.length) {
      const effect = Math.round(clamp(mean(tagHit.map((t) => t.lift)) * 0.3, -15, 15));
      if (effect) basis.push({ label: `${tagHit.length} ${tagHit.length === 1 ? 'hashtag' : 'hashtags'} with a track record`, effect });
    }
  }
  if (hooks.enough) {
    const mine = stylesOf(firstLine(input.body));
    const hit = hooks.styles.filter((s) => mine.includes(s.id) && Math.abs(s.lift) >= 15);
    if (hit.length) {
      const effect = Math.round(clamp(mean(hit.map((s) => s.lift)) * 0.4, -20, 20));
      if (effect) basis.push({ label: `Hook style: ${hit.map((s) => s.label.toLowerCase()).join(', ')}`, effect });
    }
  }

  const factor = basis.reduce((f, b) => f * (1 + b.effect / 100), 1);
  const views = Math.round(base * factor);
  // The range is as wide as this account's own posts usually spread
  const low = Math.round(views * clamp(quantile(pool, 0.25) / base, 0.3, 0.9));
  const high = Math.round(views * clamp(quantile(pool, 0.75) / base, 1.15, 3));
  return { views, low, high, base: Math.round(base), basis, posts: pool.length, at: new Date().toISOString() };
}

export async function forecastDraft(profileId: string, input: ForecastInput): Promise<Forecast | null> {
  const [posts, vocab, hooks] = await Promise.all([
    prisma.post.findMany({ where: { socialProfileId: profileId, isBoosted: false }, orderBy: { publishedAt: 'desc' }, take: 300, select: { type: true, views: true } }),
    accountVocab(profileId),
    hookLibrary(profileId),
  ]);
  return forecastFrom(posts, vocab, hooks, input);
}

export function grade(predicted: Forecast, actual: number, postedAt: Date, now = Date.now()): { verdict: Verdict; error: number } {
  const error = predicted.views > 0 ? Math.round((actual / predicted.views - 1) * 100) : 0;
  // A forecast made after the post went out had the answer in its data: shown, never counted
  if (Date.parse(predicted.at) > postedAt.getTime()) return { verdict: 'late', error };
  if (now - postedAt.getTime() < SETTLE_MS) return { verdict: 'early', error };
  return { verdict: actual > predicted.high ? 'beat' : actual < predicted.low ? 'missed' : 'hit', error };
}

const readForecast = (v: unknown): Forecast | null => {
  const f = v as Partial<Forecast> | null;
  return f && typeof f.views === 'number' && typeof f.low === 'number' && typeof f.high === 'number' && typeof f.at === 'string'
    ? { views: f.views, low: f.low, high: f.high, base: typeof f.base === 'number' ? f.base : f.views, basis: Array.isArray(f.basis) ? f.basis : [], posts: typeof f.posts === 'number' ? f.posts : 0, at: f.at }
    : null;
};

export async function scorecard(userId: string, accountId: string): Promise<Scorecard> {
  const drafts = await prisma.creativeDraft.findMany({
    where: { userId, socialProfileId: accountId, kind: 'caption', postId: { not: null } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: { id: true, title: true, data: true, postId: true },
  });
  const posts = drafts.length ? await prisma.post.findMany({ where: { id: { in: drafts.map((d) => d.postId!) }, socialProfileId: accountId }, select: { id: true, views: true, publishedAt: true } }) : [];
  const byId = new Map(posts.map((p) => [p.id, p]));
  const rows: ScoreRow[] = drafts.flatMap((d) => {
    const post = byId.get(d.postId!);
    if (!post) return [];
    const data = (d.data ?? {}) as { format?: string; predicted?: unknown };
    const predicted = readForecast(data.predicted);
    const g = predicted ? grade(predicted, post.views, post.publishedAt) : null;
    return [{ draftId: d.id, title: d.title, format: data.format ?? 'caption', postId: post.id, postedAt: post.publishedAt.toISOString(), actual: post.views, predicted, verdict: g?.verdict ?? null, error: g?.error ?? null }];
  }).sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));

  const judged = rows.filter((r) => r.verdict === 'beat' || r.verdict === 'hit' || r.verdict === 'missed');
  const errors = judged.map((r) => Math.abs(r.error ?? 0)).sort((a, b) => a - b);
  return {
    rows,
    graded: judged.length,
    inRange: judged.filter((r) => r.verdict === 'hit').length,
    beat: judged.filter((r) => r.verdict === 'beat').length,
    missed: judged.filter((r) => r.verdict === 'missed').length,
    typicalError: errors.length ? Math.round(quantile(errors, 0.5)) : null,
  };
}
