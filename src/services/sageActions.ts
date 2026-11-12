import { prisma } from '@/lib/prisma';
import type { CreatorProfile } from '@/services/ai';

// What Sage is allowed to change when the creator asks in chat. Every change is logged in SageAction,
// shows in the Overview feed, and can be undone. Corrected numbers are put back after every sync.

const POST_FIELDS = ['views', 'reach', 'likes', 'comments', 'saves', 'shares'] as const;
const ACCOUNT_FIELDS = ['reach30', 'followers'] as const;
const PROFILE_FIELDS = ['niche', 'audience', 'goals', 'postsPerWeek', 'voice', 'avoid', 'language'] as const;
type PostField = (typeof POST_FIELDS)[number];
type AccountField = (typeof ACCOUNT_FIELDS)[number];

export type ActionResult = { id: string | null; ok: boolean; summary: string };

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v.replace(/[, ]/g, ''))) ? Number(v.replace(/[, ]/g, '')) : null);
const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const fmt = (x: number) => x.toLocaleString('en-US');

// Engagement follows the corrected numbers, the same way sync works it out
function score(platform: string, p: { views: number; reach: number | null; likes: number; comments: number; saves: number; shares: number }) {
  if (platform === 'youtube') return p.views > 0 ? ((p.likes + p.comments) / p.views) * 100 : 0;
  return p.reach ? ((p.likes + p.comments + p.saves + p.shares) / p.reach) * 100 : 0;
}

async function ownedPost(userId: string, postId: string) {
  return prisma.post.findFirst({ where: { id: postId, socialProfile: { userId } } });
}

async function ownedProfile(userId: string, account: unknown) {
  const profiles = await prisma.socialProfile.findMany({ where: { userId } });
  const name = str(account).replace(/^@/, '').toLowerCase();
  if (name) return profiles.find((p) => p.username.toLowerCase() === name || p.id === account) ?? null;
  return profiles.length === 1 ? profiles[0] : null;
}

// ---------- Memory: facts Sage keeps between conversations ----------

export type MemoryItem = { id: string; fact: string; at: string };
const memoryKey = (userId: string) => `memory:${userId}`;

export async function getMemory(userId: string): Promise<MemoryItem[]> {
  const row = await prisma.appConfig.findUnique({ where: { key: memoryKey(userId) } });
  try {
    return row ? (JSON.parse(row.value) as MemoryItem[]) : [];
  } catch {
    return [];
  }
}

async function saveMemory(userId: string, items: MemoryItem[]) {
  const value = JSON.stringify(items.slice(-40));
  await prisma.appConfig.upsert({ where: { key: memoryKey(userId) }, create: { key: memoryKey(userId), value }, update: { value } });
}

export async function memoryText(userId: string) {
  const items = await getMemory(userId);
  return items.length ? `\n## What the creator asked Sage to remember\n${items.map((m) => `- ${m.fact}`).join('\n')}\n` : '';
}

// ---------- Corrections in place, for the AI prompts and the Status page ----------

export async function activeCorrections(userId: string) {
  return prisma.sageAction.findMany({
    where: { userId, active: true, kind: { in: ['correct_post', 'correct_account', 'mark_boosted'] } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function correctionsText(userId: string) {
  const rows = await activeCorrections(userId);
  return rows.length ? `\n## Numbers the creator corrected by hand (trust these over the platform's)\n${rows.map((r) => `- ${r.summary}`).join('\n')}\n` : '';
}

// Sync writes whatever the platform says; corrections the creator made win again afterwards
export async function reapplyCorrections(profileId: string) {
  const profile = await prisma.socialProfile.findUnique({ where: { id: profileId }, select: { id: true, userId: true } });
  if (!profile) return;
  const rows = await prisma.sageAction.findMany({ where: { userId: profile.userId, active: true, kind: { in: ['correct_post', 'correct_account', 'mark_boosted'] } }, orderBy: { createdAt: 'asc' } });
  for (const r of rows) {
    if (r.kind === 'correct_account' && r.target === profileId) {
      const value = n(r.value);
      if (value == null) continue;
      await prisma.socialProfile.update({ where: { id: profileId }, data: r.field === 'followers' ? { followerCount: Math.round(value) } : { reach30: Math.round(value) } }).catch(() => {});
    } else if (r.target && (r.kind === 'correct_post' || r.kind === 'mark_boosted')) {
      const post = await prisma.post.findFirst({ where: { id: r.target, socialProfileId: profileId } });
      if (!post) continue;
      if (r.kind === 'mark_boosted') {
        await prisma.post.update({ where: { id: post.id }, data: { isBoosted: r.value === true } });
      } else {
        const value = n(r.value);
        if (value == null || !POST_FIELDS.includes(r.field as PostField)) continue;
        const next = { ...post, [r.field as PostField]: Math.round(value) };
        await prisma.post.update({ where: { id: post.id }, data: { [r.field as PostField]: Math.round(value), performanceScore: score(post.platform, next) } });
      }
    }
  }
}

// ---------- Applying one action ----------

type Raw = Record<string, unknown> & { type?: unknown };

async function log(userId: string, data: { kind: string; summary: string; target?: string; field?: string; value?: unknown; before?: unknown }) {
  const row = await prisma.sageAction.create({
    data: { userId, kind: data.kind, summary: data.summary, target: data.target ?? null, field: data.field ?? null, value: (data.value ?? null) as never, before: (data.before ?? null) as never },
  });
  return { id: row.id, ok: true, summary: data.summary };
}

export async function applyAction(userId: string, raw: Raw): Promise<ActionResult> {
  const fail = (summary: string): ActionResult => ({ id: null, ok: false, summary });
  switch (raw.type) {
    case 'correct_post': {
      const field = str(raw.field) as PostField;
      const value = n(raw.value);
      if (!POST_FIELDS.includes(field) || value == null || value < 0) return fail('Could not correct that post: the number or field was unclear.');
      const post = await ownedPost(userId, str(raw.postId, 120));
      if (!post) return fail('Could not find that post to correct.');
      if (post.platform === 'youtube' && ['reach', 'saves', 'shares'].includes(field)) return fail(`YouTube does not have ${field}.`);
      const before = post[field];
      const next = { ...post, [field]: Math.round(value) };
      await prisma.post.update({ where: { id: post.id }, data: { [field]: Math.round(value), performanceScore: score(post.platform, next) } });
      // A newer correction of the same number replaces the old one
      await prisma.sageAction.updateMany({ where: { userId, kind: 'correct_post', target: post.id, field, active: true }, data: { active: false } });
      const label = post.caption.replace(/\s+/g, ' ').trim().slice(0, 40) || 'post';
      return log(userId, { kind: 'correct_post', summary: `${field[0].toUpperCase()}${field.slice(1)} of "${label}" set to ${fmt(Math.round(value))} (was ${before == null ? 'empty' : fmt(before)})`, target: post.id, field, value: Math.round(value), before });
    }
    case 'correct_account': {
      const field = (str(raw.field) === 'reach' ? 'reach30' : str(raw.field)) as AccountField;
      const value = n(raw.value);
      if (!ACCOUNT_FIELDS.includes(field) || value == null || value < 0) return fail('Could not correct that: the number or field was unclear.');
      const profile = await ownedProfile(userId, raw.account);
      if (!profile) return fail('Which account? Say the @username and I will fix it.');
      const before = field === 'followers' ? profile.followerCount : profile.reach30;
      await prisma.socialProfile.update({ where: { id: profile.id }, data: field === 'followers' ? { followerCount: Math.round(value) } : { reach30: Math.round(value) } });
      await prisma.sageAction.updateMany({ where: { userId, kind: 'correct_account', target: profile.id, field, active: true }, data: { active: false } });
      const what = field === 'followers' ? (profile.platform === 'youtube' ? 'Subscribers' : 'Followers') : 'Accounts reached (30 days)';
      return log(userId, { kind: 'correct_account', summary: `${what} for @${profile.username} set to ${fmt(Math.round(value))} (was ${before == null ? 'empty' : fmt(before)})`, target: profile.id, field, value: Math.round(value), before });
    }
    case 'mark_boosted': {
      const post = await ownedPost(userId, str(raw.postId, 120));
      if (!post) return fail('Could not find that post.');
      const boosted = raw.boosted !== false;
      await prisma.post.update({ where: { id: post.id }, data: { isBoosted: boosted } });
      await prisma.sageAction.updateMany({ where: { userId, kind: 'mark_boosted', target: post.id, active: true }, data: { active: false } });
      const label = post.caption.replace(/\s+/g, ' ').trim().slice(0, 40) || 'post';
      return log(userId, { kind: 'mark_boosted', summary: `"${label}" marked as ${boosted ? 'boosted (left out of patterns)' : 'organic'}`, target: post.id, field: 'isBoosted', value: boosted, before: post.isBoosted });
    }
    case 'remember': {
      const fact = str(raw.fact, 240);
      if (!fact) return fail('Nothing to remember.');
      const items = await getMemory(userId);
      const item = { id: crypto.randomUUID(), fact, at: new Date().toISOString() };
      await saveMemory(userId, [...items, item]);
      return log(userId, { kind: 'remember', summary: `Remembered: ${fact}`, target: item.id, value: fact });
    }
    case 'update_profile': {
      const field = str(raw.field) as (typeof PROFILE_FIELDS)[number];
      if (!PROFILE_FIELDS.includes(field)) return fail('Could not update the creator profile: unknown field.');
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { creatorProfile: true } });
      const current = (user?.creatorProfile as CreatorProfile | null) ?? {};
      const value = field === 'postsPerWeek' ? n(raw.value) : str(raw.value, 600);
      if (value == null || value === '') return fail('Could not update the creator profile: the value was empty.');
      await prisma.user.update({ where: { id: userId }, data: { creatorProfile: { ...current, [field]: value } } });
      return log(userId, { kind: 'update_profile', summary: `Creator profile: ${field} set to "${String(value).slice(0, 60)}"`, field, value, before: (current as Record<string, unknown>)[field] ?? null });
    }
    case 'set_goal': {
      const target = n(raw.target);
      if (target == null || target <= 0) return fail('Could not set the goal: the target was unclear.');
      const deadline = /^\d{4}-\d{2}-\d{2}$/.test(str(raw.deadline)) ? str(raw.deadline) : undefined;
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { goal: true } });
      const goal = { target: Math.round(target), ...(deadline ? { deadline } : {}) };
      await prisma.user.update({ where: { id: userId }, data: { goal } });
      return log(userId, { kind: 'set_goal', summary: `Goal set to ${fmt(goal.target)}${deadline ? ` by ${deadline}` : ''}`, field: 'goal', value: goal, before: user?.goal ?? null });
    }
    case 'save_idea': {
      const title = str(raw.title, 160);
      if (!title) return fail('No idea to save.');
      const idea = await prisma.savedIdea.create({ data: { userId, title, notes: str(raw.notes, 2000), format: str(raw.format, 40) || null, source: 'brainstorm' } });
      return log(userId, { kind: 'save_idea', summary: `Saved to your idea board: ${title.slice(0, 70)}`, target: idea.id });
    }
    default:
      return fail('Sage tried an action it is not allowed to do.');
  }
}

export async function undoAction(userId: string, id: string) {
  const row = await prisma.sageAction.findFirst({ where: { id, userId } });
  if (!row || row.undoneAt) return false;
  const before = row.before as unknown;
  if (row.kind === 'correct_post' && row.target && row.field) {
    const post = await prisma.post.findUnique({ where: { id: row.target } });
    if (post && POST_FIELDS.includes(row.field as PostField)) {
      const value = row.field === 'reach' ? (n(before) == null ? null : Math.round(n(before)!)) : Math.round(n(before) ?? 0);
      const next = { ...post, [row.field]: value };
      await prisma.post.update({ where: { id: post.id }, data: { [row.field]: value, performanceScore: score(post.platform, next as typeof post) } });
    }
  } else if (row.kind === 'correct_account' && row.target) {
    const value = n(before);
    await prisma.socialProfile.update({ where: { id: row.target }, data: row.field === 'followers' ? { followerCount: Math.round(value ?? 0) } : { reach30: value == null ? null : Math.round(value) } }).catch(() => {});
  } else if (row.kind === 'mark_boosted' && row.target) {
    await prisma.post.update({ where: { id: row.target }, data: { isBoosted: before === true } }).catch(() => {});
  } else if (row.kind === 'remember' && row.target) {
    await saveMemory(userId, (await getMemory(userId)).filter((m) => m.id !== row.target));
  } else if (row.kind === 'update_profile' && row.field) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { creatorProfile: true } });
    const current = { ...((user?.creatorProfile as Record<string, unknown> | null) ?? {}) };
    if (before == null) delete current[row.field];
    else current[row.field] = before;
    await prisma.user.update({ where: { id: userId }, data: { creatorProfile: current as object } });
  } else if (row.kind === 'set_goal') {
    await prisma.user.update({ where: { id: userId }, data: { goal: (before ?? null) as never } });
  } else if (row.kind === 'save_idea' && row.target) {
    await prisma.savedIdea.deleteMany({ where: { id: row.target, userId } });
  }
  await prisma.sageAction.update({ where: { id: row.id }, data: { active: false, undoneAt: new Date() } });
  return true;
}

// ---------- Reading actions out of a Sage reply ----------

// Sage ends a reply with <actions>[...]</actions> when it should change something
export function splitActions(text: string): { text: string; actions: Raw[] } {
  const m = text.match(/<actions>\s*([\s\S]*?)\s*<\/actions>/i);
  if (!m) return { text: text.trim(), actions: [] };
  const cleaned = text.replace(m[0], '').trim();
  try {
    const parsed = JSON.parse(m[1].replace(/^```(?:json)?|```$/g, '').trim());
    const list = (Array.isArray(parsed) ? parsed : [parsed]).filter((a): a is Raw => !!a && typeof a === 'object');
    return { text: cleaned, actions: list.slice(0, 5) };
  } catch {
    return { text: cleaned, actions: [] };
  }
}

export const ACTIONS_PROMPT = `
## You can change things
When the creator clearly asks you to change, fix, correct, remember, save or set something, do it by ending your reply with one block like:
<actions>[{"type": "...", ...}]</actions>
Allowed actions:
- {"type":"correct_post","postId":"<id from the posts table>","field":"views|reach|likes|comments|saves|shares","value":1234} — when they say a post's number is wrong and give the right one.
- {"type":"correct_account","account":"<username>","field":"reach|followers","value":1234} — account-wide reach (last 30 days) or follower count is wrong.
- {"type":"mark_boosted","postId":"<id>","boosted":true} — a post was (or was not) paid promotion.
- {"type":"remember","fact":"<short fact>"} — something to keep in mind in every future answer.
- {"type":"update_profile","field":"niche|audience|goals|postsPerWeek|voice|avoid|language","value":"..."} — their niche, audience, goals or style changed.
- {"type":"set_goal","target":5000,"deadline":"YYYY-MM-DD"} — a follower or subscriber goal (deadline optional).
- {"type":"save_idea","title":"...","notes":"hook, format, why","format":"reel"} — save an idea to their idea board.
Rules: only act when they asked for it or plainly stated the right value. If the value or the post is unclear, ask instead of guessing. Use real ids from the table. In the visible text, say in one line what you changed; they get an Undo button. Never show the <actions> block's JSON in the text itself.
`;
