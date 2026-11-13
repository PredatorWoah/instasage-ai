import { prisma } from '@/lib/prisma';
import { localParts } from '@/services/analysis';
import { firstLine, hookLibrary } from '@/services/hooks';
import { cachedQuestions } from '@/services/questions';
import { accountVocab } from '@/services/vocab';
import type { CreatorProfile } from '@/services/ai';

// The weekly digest: the last 7 days in a few lines, and three things to do next. All arithmetic,
// so it costs nothing and reads the same on the page, in the push and in the email.

export type WeeklyPost = { id: string; hook: string; type: string; views: number; vsUsual: number | null };
export type WeeklyTodo = { text: string; href: string };
export type Weekly = {
  from: string;
  to: string;
  accounts: { username: string; platform: string; followers: number; change: number | null }[];
  posts: number;
  postsBefore: number; // the 7 days before that
  views: number; // views so far on this week's posts
  best: WeeklyPost | null;
  weakest: WeeklyPost | null;
  planned: { title: string; at: string }[]; // on the calendar for the next 7 days
  questions: number; // comment questions still unanswered, from the last read
  todo: WeeklyTodo[];
};

const DAY = 86_400_000;
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const hookOf = (caption: string, type: string) => firstLine(caption).slice(0, 90) || `Untitled ${type}`;

export async function weeklyDigest(userId: string, now = Date.now()): Promise<Weekly | null> {
  const profiles = await prisma.socialProfile.findMany({ where: { userId }, select: { id: true, username: true, platform: true, followerCount: true } });
  if (!profiles.length) return null;
  const ids = profiles.map((p) => p.id);
  const weekAgo = new Date(now - 7 * DAY);

  const accounts = await Promise.all(profiles.map(async (p) => {
    const before = await prisma.metric.findFirst({ where: { socialProfileId: p.id, followers: { not: null }, date: { lte: new Date(now - 6.5 * DAY) } }, orderBy: { date: 'desc' }, select: { followers: true, date: true } });
    // A snapshot from months ago says nothing about this week
    const usable = before?.followers != null && now - before.date.getTime() < 10 * DAY;
    return { username: p.username, platform: p.platform, followers: p.followerCount, change: usable ? p.followerCount - before.followers! : null };
  }));

  const [week, postsBefore, history, planned, user] = await Promise.all([
    prisma.post.findMany({ where: { socialProfileId: { in: ids }, publishedAt: { gte: weekAgo, lte: new Date(now) } }, orderBy: { views: 'desc' }, select: { id: true, caption: true, type: true, views: true, socialProfileId: true, isBoosted: true } }),
    prisma.post.count({ where: { socialProfileId: { in: ids }, publishedAt: { gte: new Date(now - 14 * DAY), lt: weekAgo } } }),
    prisma.post.findMany({ where: { socialProfileId: { in: ids }, isBoosted: false, publishedAt: { lt: weekAgo } }, orderBy: { publishedAt: 'desc' }, take: 300, select: { views: true, socialProfileId: true } }),
    prisma.savedIdea.findMany({ where: { userId, status: { not: 'posted' }, scheduledFor: { gte: new Date(now), lte: new Date(now + 7 * DAY) } }, orderBy: { scheduledFor: 'asc' }, select: { title: true, scheduledFor: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { creatorProfile: true } }),
  ]);
  // Each post is measured against its own account's usual views
  const usual = new Map(ids.map((id) => [id, median(history.filter((h) => h.socialProfileId === id).map((h) => h.views))]));
  const row = (p: (typeof week)[number]): WeeklyPost => {
    const base = usual.get(p.socialProfileId) ?? 0;
    return { id: p.id, hook: hookOf(p.caption, p.type), type: p.type, views: p.views, vsUsual: base > 0 ? Math.round((p.views / base - 1) * 100) : null };
  };
  const organic = week.filter((p) => !p.isBoosted);
  const best = organic[0] ? row(organic[0]) : null;
  const weakest = organic.length >= 3 ? row(organic[organic.length - 1]) : null;

  const questions = (await cachedQuestions(userId, 'all').catch(() => null))?.unanswered ?? 0;

  // Three things to do, the most pressing first
  const todo: WeeklyTodo[] = [];
  const target = Math.max(1, Math.round((user?.creatorProfile as CreatorProfile | null)?.postsPerWeek ?? 3));
  if (planned.length < target) {
    todo.push({ text: planned.length ? `Only ${planned.length} of your ${target} posts for next week ${planned.length === 1 ? 'is' : 'are'} planned. Schedule ${target - planned.length} more.` : `Nothing is planned for next week. Put ${target} ${target === 1 ? 'post' : 'posts'} on the calendar.`, href: '/recommendations?tab=calendar' });
  }
  if (best && (best.vsUsual ?? 0) >= 20) todo.push({ text: `"${best.hook}" did ${best.vsUsual}% better than usual. Make a follow-up while it is warm.`, href: `/create?from=${encodeURIComponent(best.id)}` });
  if (questions > 0) todo.push({ text: `${questions} ${questions === 1 ? 'question is' : 'questions are'} waiting in your comments. Answer them, or turn the common ones into a post.`, href: '/comments?view=questions' });
  // The biggest account's strongest pattern, as a nudge for the next caption
  const main = [...profiles].sort((a, b) => b.followerCount - a.followerCount)[0];
  if (todo.length < 3) {
    const lib = await hookLibrary(main.id).catch(() => null);
    const style = lib?.enough ? lib.styles.find((s) => s.lift >= 20) : null;
    if (style) todo.push({ text: `Hooks in this style do ${style.lift}% better for you: ${style.label.toLowerCase()}. Use it on the next post.`, href: '/create?tab=hooks' });
  }
  if (todo.length < 3) {
    const vocab = await accountVocab(main.id).catch(() => null);
    const word = vocab?.enough ? vocab.words.good[0] : null;
    if (word) todo.push({ text: `Posts with "${word.term}" get ${word.lift}% more views (${word.posts} posts). Work it into this week's captions.`, href: '/create' });
  }
  if (!week.length && todo.length < 3) todo.push({ text: 'You did not post this week. One post beats a perfect plan: write one now.', href: '/create' });

  return {
    from: weekAgo.toISOString(),
    to: new Date(now).toISOString(),
    accounts,
    posts: week.length,
    postsBefore,
    views: week.reduce((a, p) => a + p.views, 0),
    best,
    weakest,
    planned: planned.map((p) => ({ title: p.title, at: p.scheduledFor!.toISOString() })),
    questions,
    todo: todo.slice(0, 3),
  };
}

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toLocaleString('en-US')}`;

// The digest as a short notification
export function weeklyPush(w: Weekly) {
  const moved = w.accounts.filter((a) => a.change != null);
  const total = moved.reduce((a, x) => a + (x.change ?? 0), 0);
  const title = moved.length ? `Your week: ${signed(total)} ${moved.every((a) => a.platform === 'youtube') ? 'subscribers' : 'followers'}, ${w.posts} ${w.posts === 1 ? 'post' : 'posts'}` : `Your week: ${w.posts} ${w.posts === 1 ? 'post' : 'posts'}`;
  const body = [w.best ? `Best: "${w.best.hook.slice(0, 50)}" with ${w.best.views.toLocaleString('en-US')} views` : '', w.todo[0]?.text ?? ''].filter(Boolean).join('\n');
  return { title, body: body || 'Open InstaSage for the full week.' };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The digest as an email: plain text and a simple HTML version that reads fine in any mail app
export function weeklyEmail(w: Weekly, site: string, timeZone: string) {
  const date = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short' }).format(new Date(iso));
  const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
  const link = (href: string) => `${site.replace(/\/$/, '')}${href}`;
  const subject = `${weeklyPush(w).title} (${date(w.from)} to ${date(w.to)})`;
  const lines: string[] = [];
  for (const a of w.accounts) lines.push(`@${a.username}: ${a.followers.toLocaleString('en-US')} ${a.platform === 'youtube' ? 'subscribers' : 'followers'}${a.change != null ? ` (${signed(a.change)} this week)` : ''}`);
  lines.push(`Posts this week: ${w.posts} (the week before: ${w.postsBefore}), ${w.views.toLocaleString('en-US')} views so far`);
  if (w.best) lines.push(`Best: "${w.best.hook}", ${w.best.views.toLocaleString('en-US')} views${w.best.vsUsual != null ? ` (${signed(w.best.vsUsual)}% against your usual)` : ''}`);
  if (w.weakest) lines.push(`Weakest: "${w.weakest.hook}", ${w.weakest.views.toLocaleString('en-US')} views${w.weakest.vsUsual != null ? ` (${signed(w.weakest.vsUsual)}% against your usual)` : ''}`);
  const plan = w.planned.length ? w.planned.map((p) => `${when(p.at)}: ${p.title}`) : ['Nothing planned yet.'];
  const text = [subject, '', ...lines, '', 'Next 7 days', ...plan, '', 'Do these three', ...w.todo.map((t, i) => `${i + 1}. ${t.text} ${link(t.href)}`), '', link('/reports')].join('\n');
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#16161d;line-height:1.5">
<h1 style="font-size:22px;margin:0 0 4px">${esc(weeklyPush(w).title)}</h1>
<p style="color:#6b6b7b;margin:0 0 20px;font-size:13px">${esc(date(w.from))} to ${esc(date(w.to))}</p>
${lines.map((l) => `<p style="margin:0 0 8px;font-size:15px">${esc(l)}</p>`).join('\n')}
<h2 style="font-size:16px;margin:24px 0 8px">Next 7 days</h2>
${plan.map((l) => `<p style="margin:0 0 6px;font-size:15px">${esc(l)}</p>`).join('\n')}
<h2 style="font-size:16px;margin:24px 0 8px">Do these three</h2>
<ol style="padding-left:20px;margin:0">${w.todo.map((t) => `<li style="margin:0 0 10px;font-size:15px">${esc(t.text)} <a href="${esc(link(t.href))}" style="color:#6d4aff">Open</a></li>`).join('')}</ol>
<p style="margin:28px 0 0"><a href="${esc(link('/reports'))}" style="display:inline-block;background:#16161d;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:700;font-size:14px">Open InstaSage</a></p>
</div>`;
  return { subject, text, html };
}

// Monday morning in the creator's own timezone, once per week
export function weeklyDue(timeZone: string, lastSent: string | null, now = new Date()) {
  const local = localParts(now, timeZone);
  return local.weekday === 0 && lastSent !== local.dayKey ? local.dayKey : null;
}
