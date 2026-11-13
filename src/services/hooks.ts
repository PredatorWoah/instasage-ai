import { prisma } from '@/lib/prisma';

// Hook library: the first line of every caption the account has posted, with how that post did,
// and which styles of opening line go with the better posts. Plain arithmetic, no AI.

export type HookStyle = { id: string; label: string; posts: number; lift: number };
export type Hook = { postId: string; line: string; type: string; views: number; saves: number; lift: number; publishedAt: string; styles: string[] };
export type HookLibrary = {
  posts: number; // organic posts with a caption
  enough: boolean;
  medianViews: number;
  hooks: Hook[]; // best first
  styles: HookStyle[]; // styles with enough posts on both sides to compare, best first
};

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Hinglish written in Latin letters: a few very common function words are enough to tell
const HINGLISH = /\b(hai|hain|nahi|nahin|kya|kyun|kyu|kaise|aap|tum|mera|meri|apna|apni|aur|par|lekin|bhi|toh|wala|wali|raha|rahi|gaya|gayi|karo|kar|ke liye|sab|kuch|bahut|abhi|yeh|woh)\b/i;

export const HOOK_STYLES: { id: string; label: string; test: (line: string) => boolean }[] = [
  { id: 'question', label: 'Opens with a question', test: (l) => /\?/.test(l) },
  { id: 'hinglish', label: 'Hinglish', test: (l) => HINGLISH.test(l) || /[ऀ-ॿ]/.test(l) },
  { id: 'number', label: 'Has a number', test: (l) => /\d/.test(l) },
  { id: 'emoji', label: 'Has an emoji', test: (l) => /\p{Extended_Pictographic}/u.test(l) },
  { id: 'you', label: 'Talks to "you"', test: (l) => /\b(you|your|you're|aap|aapka|aapki|tum|tumhara)\b/i.test(l) },
  { id: 'short', label: 'Short (under 50 characters)', test: (l) => l.length < 50 },
  { id: 'negative', label: 'Names a problem or mistake', test: (l) => /\b(stop|never|don't|dont|avoid|mistake|wrong|worst|problem|myth|galti|mat)\b/i.test(l) },
];

// The hook is the first line that has real words in it (a line of only emoji or hashtags is skipped)
export function firstLine(caption: string) {
  for (const raw of caption.split('\n')) {
    const line = raw.trim();
    if (line.replace(/[#@][\p{L}\p{N}_.]+/gu, '').replace(/[^\p{L}\p{N}]/gu, '').length >= 3) return line.slice(0, 200);
  }
  return '';
}

export const stylesOf = (line: string) => HOOK_STYLES.filter((s) => s.test(line)).map((s) => s.id);

export async function hookLibrary(profileId: string): Promise<HookLibrary> {
  const rows = await prisma.post.findMany({
    where: { socialProfileId: profileId, isBoosted: false },
    orderBy: { publishedAt: 'desc' },
    take: 300,
    select: { id: true, caption: true, type: true, views: true, saves: true, publishedAt: true },
  });
  const withHook = rows.map((r) => ({ ...r, line: firstLine(r.caption) })).filter((r) => r.line);
  const base = median(withHook.map((r) => r.views));
  const hooks: Hook[] = withHook.map((r) => ({
    postId: r.id,
    line: r.line,
    type: r.type,
    views: r.views,
    saves: r.saves,
    lift: base > 0 ? Math.round((r.views / base - 1) * 100) : 0,
    publishedAt: r.publishedAt.toISOString(),
    styles: stylesOf(r.line),
  })).sort((a, b) => b.views - a.views);

  // A style is only compared when at least 2 posts use it and at least 2 do not
  const min = hooks.length >= 40 ? 3 : 2;
  const styles: HookStyle[] = [];
  for (const s of HOOK_STYLES) {
    const using = hooks.filter((h) => h.styles.includes(s.id));
    const rest = hooks.length - using.length;
    if (using.length < min || rest < min || base <= 0) continue;
    styles.push({ id: s.id, label: s.label, posts: using.length, lift: Math.round((median(using.map((h) => h.views)) / base - 1) * 100) });
  }
  styles.sort((a, b) => b.lift - a.lift);
  return { posts: hooks.length, enough: hooks.length >= 8, medianViews: Math.round(base), hooks, styles };
}

// The same library as prompt text for Sage
export function hooksText(lib: HookLibrary) {
  if (!lib.enough) return '';
  const top = lib.hooks.filter((h) => h.lift > 0).slice(0, 6);
  const good = lib.styles.filter((s) => s.lift >= 15);
  const bad = lib.styles.filter((s) => s.lift <= -15);
  if (!top.length && !good.length && !bad.length) return '';
  return `
## Opening lines that worked for this account
${top.map((h) => `- "${h.line.slice(0, 140)}" (${h.views} views, +${h.lift}% over the median)`).join('\n') || '- none stand out yet'}
${good.length ? `Hook styles that do better: ${good.map((s) => `${s.label.toLowerCase()} (+${s.lift}% over ${s.posts} posts)`).join(', ')}.` : ''}
${bad.length ? `Hook styles that do worse: ${bad.map((s) => `${s.label.toLowerCase()} (${s.lift}% over ${s.posts} posts)`).join(', ')}.` : ''}
Write hooks in the styles that do better. Never reuse an old opening line word for word.
`;
}
