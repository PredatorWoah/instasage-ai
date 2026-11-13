import { prisma } from '@/lib/prisma';

// Which words, phrases and hashtags go with this account's better posts, and which go with its worse ones.
// Plain arithmetic on the account's own captions: no AI, so it is free and the same every time.

export type Term = { term: string; posts: number; lift: number; savesLift: number };
export type Vocab = {
  posts: number; // organic posts analysed
  enough: boolean; // enough posts to trust the lists
  words: { good: Term[]; bad: Term[] };
  hashtags: { good: Term[]; bad: Term[]; used: string[] }; // used: every tag the account has used that is not on the weak list
  style: { length: string | null; hook: string | null; emojiFirstLine: string | null };
};

// Words that carry no meaning on their own, in English and the Hinglish many Indian creators write in
const STOP = new Set(`a an the and or but if so of to in on at by for from with without into onto over under about above after before again
than then that this these those there here what which who whom whose when where why how all any both each few more most other some such
no nor not only own same too very can will just don should now is are was were be been being have has had do does did doing i me my we our
you your yours he him his she her it its they them their am get got let lets make made also really still ever even much many one two
like know see go going come want need use using way day days thing things time out up down off yes ok okay im youre dont cant its thats
hai hain ka ki ke ko se me mein aur ye yeh wo woh toh to bhi na nahi kya par pe ek ho hota hoti tha thi the kar karo karna apna apni apne
jo ab hi bas sab koi kuch mera meri mere tera teri tumhara aap hum raha rahi rahe wala wali wale`.split(/\s+/));

const tokens = (caption: string) =>
  caption
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[@#][\p{L}\p{N}_.]+/gu, ' ')
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));

const hashtagsOf = (caption: string) => [...new Set((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.toLowerCase()))];
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

type P = { views: number; saves: number; terms: Set<string>; tags: Set<string> };

function rank(posts: P[], pick: (p: P) => Set<string>, minCount: number) {
  const baseViews = median(posts.map((p) => p.views)) || 1;
  const baseSaves = median(posts.map((p) => p.saves)) || 1;
  const groups = new Map<string, P[]>();
  for (const p of posts) for (const t of pick(p)) groups.set(t, [...(groups.get(t) ?? []), p]);
  const terms: Term[] = [];
  for (const [term, rows] of groups) {
    // A word on (almost) every post says nothing about what works
    if (rows.length < minCount || rows.length > posts.length * 0.7) continue;
    terms.push({
      term,
      posts: rows.length,
      lift: Math.round((median(rows.map((r) => r.views)) / baseViews - 1) * 100),
      savesLift: Math.round((median(rows.map((r) => r.saves)) / baseSaves - 1) * 100),
    });
  }
  // More posts behind a number = more trust in it
  const weight = (t: Term) => t.lift * Math.min(1, t.posts / 4);
  return {
    good: terms.filter((t) => t.lift >= 15).sort((a, b) => weight(b) - weight(a)),
    bad: terms.filter((t) => t.lift <= -20).sort((a, b) => weight(a) - weight(b)),
  };
}

// A phrase that covers a word (e.g. "skin barrier" and "barrier") keeps only the phrase,
// when the phrase did about as well: the phrase is what actually works
function dedupe(list: Term[], max: number) {
  const phrases = list.filter((t) => t.term.includes(' '));
  const covered = (t: Term) => !t.term.includes(' ') && phrases.some((p) => p.term.split(' ').includes(t.term) && p.posts >= t.posts - 1 && Math.abs(p.lift - t.lift) <= 15);
  const out: Term[] = [];
  for (const t of list.filter((x) => !covered(x))) {
    if (out.some((o) => o.term.includes(t.term) || t.term.includes(o.term))) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

export async function accountVocab(profileId: string): Promise<Vocab> {
  const rows = await prisma.post.findMany({
    where: { socialProfileId: profileId, isBoosted: false },
    orderBy: { publishedAt: 'desc' },
    take: 300,
    select: { caption: true, views: true, saves: true },
  });
  const posts: P[] = rows.map((r) => {
    const words = tokens(r.caption);
    const pairs = words.slice(1).map((w, i) => `${words[i]} ${w}`);
    return { views: r.views, saves: r.saves, terms: new Set([...words, ...pairs]), tags: new Set(hashtagsOf(r.caption)) };
  });
  const minCount = posts.length >= 40 ? 3 : 2;
  const words = rank(posts, (p) => p.terms, minCount);
  const tags = rank(posts, (p) => p.tags, minCount);

  // Caption shape: length bucket and first-line style with the best median views
  const best = (pick: (r: (typeof rows)[number]) => string) => {
    const g = new Map<string, number[]>();
    for (const r of rows) g.set(pick(r), [...(g.get(pick(r)) ?? []), r.views]);
    const ranked = [...g].filter(([, v]) => v.length >= minCount).map(([k, v]) => [k, median(v)] as const).sort((a, b) => b[1] - a[1]);
    return ranked.length >= 2 ? ranked[0][0] : null;
  };
  const firstLine = (c: string) => c.split('\n')[0] ?? '';
  return {
    posts: posts.length,
    enough: posts.length >= 8,
    words: { good: dedupe(words.good, 14), bad: dedupe(words.bad, 10) },
    hashtags: { good: tags.good.slice(0, 12), bad: tags.bad.slice(0, 8), used: [...new Set(posts.flatMap((p) => [...p.tags]))].filter((t) => !tags.bad.some((b) => b.term === t)).slice(0, 80) },
    style: {
      length: best((r) => (r.caption.length < 80 ? 'short (under 80 characters)' : r.caption.length < 250 ? 'medium (80 to 250 characters)' : 'long (over 250 characters)')),
      hook: best((r) => (/\?/.test(firstLine(r.caption)) ? 'opens with a question' : 'opens with a statement')),
      emojiFirstLine: best((r) => (/\p{Extended_Pictographic}/u.test(firstLine(r.caption)) ? 'emoji in the first line' : 'no emoji in the first line')),
    },
  };
}

// The same lists as prompt text for Sage
export function vocabText(v: Vocab, strict: boolean) {
  if (!v.enough || (!v.words.good.length && !v.hashtags.good.length)) {
    return `\n## Words that work\nOnly ${v.posts} posts so far, too few to tell which words work. Lean on the brand kit and the creator's voice.\n`;
  }
  const fmt = (t: Term) => `"${t.term}" (${t.lift >= 0 ? '+' : ''}${t.lift}% views over ${t.posts} posts${t.savesLift > 30 ? `, +${t.savesLift}% saves` : ''})`;
  return `
## Words that work for this account (from its own ${v.posts} posts)
Proven words and phrases: ${v.words.good.map(fmt).join(', ') || 'none clear yet'}
Words that went with weaker posts, avoid them: ${v.words.bad.map(fmt).join(', ') || 'none clear'}
Proven hashtags: ${v.hashtags.good.map((t) => t.term).join(' ') || 'none clear yet'}
Hashtags that went with weaker posts, avoid them: ${v.hashtags.bad.map((t) => t.term).join(' ') || 'none'}
Caption shape that does best: ${[v.style.length, v.style.hook, v.style.emojiFirstLine].filter(Boolean).join(', ') || 'no clear pattern'}
${strict
    ? 'Build the caption mainly from the proven words and phrases: use at least 3 of them naturally, never use the weaker ones, and take hashtags only from the proven list or the brand kit sets. No generic filler words.'
    : 'Prefer the proven words and phrases where they fit naturally, and avoid the weaker ones.'}
`;
}
