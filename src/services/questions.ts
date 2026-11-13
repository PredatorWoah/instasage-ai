import { prisma } from '@/lib/prisma';
import { getInstagramComments, IgPermissionError } from '@/services/instagram';
import { tokens } from '@/services/vocab';

// Comment mining: the questions people ask under the account's posts, grouped by what they are about.
// Each question is a post someone already asked for. Finding and grouping them is plain text matching;
// turning the groups into post ideas is the one step that uses AI, and it is optional.

export type Question = { id: string; text: string; username: string; at: string; likes: number; answered: boolean; postId: string; postCaption: string };
export type Theme = { key: string; label: string; questions: Question[] };
export type QuestionIdea = { title: string; format: string; why: string; asked: number };
export type Mined = {
  at: string;
  postsRead: number;
  postsFailed: number;
  comments: number; // comments read, the account's own left out
  questions: number;
  unanswered: number;
  themes: Theme[];
  ideas?: QuestionIdea[];
  ideasModel?: string;
};

const START = /^(how|what|which|where|when|why|who|whom|can|could|does|do|did|is|are|will|would|should|any|price|cost)\b/i;
// Hinglish question words, written in Latin letters or Devanagari
const HINGLISH = /\b(kya|kaise|kese|kyun|kyu|kyon|kab|kaha|kahan|kidhar|kitna|kitne|kitni|konsa|kaunsa|kaun|milega|milegi|chalega|chalegi|batao|bataiye|bataye)\b|क्या|कैसे|क्यों|कब|कहाँ|कितना|कितने/i;

export function isQuestion(text: string) {
  const t = text.replace(/@[\w.]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.split(' ').length < 2 || t.length < 8) return false;
  return /[?？]/.test(t) || START.test(t) || HINGLISH.test(t);
}

// Words that say nothing about the topic of a question
const FILLER = new Set(['liye', 'wala', 'wali', 'best', 'good', 'work', 'works', 'really', 'available', 'please', 'pls', 'plz', 'sir', 'mam', "ma'am", 'bro', 'hello', 'tell', 'available', 'thanks', 'thank', 'kindly', 'batao', 'bataiye', 'bataye', 'kaise', 'kya', 'kyun', 'kab', 'kitna', 'kitne', 'kitni', 'milega', 'milegi', 'chalega', 'karna', 'karu', 'karun', 'sakte', 'sakti', 'sakta']);

export function groupQuestions(questions: Question[]): Theme[] {
  const words = questions.map((q) => [...new Set(tokens(q.text).filter((w) => !FILLER.has(w)))]);
  const count = new Map<string, number>();
  for (const ws of words) for (const w of ws) count.set(w, (count.get(w) ?? 0) + 1);
  const themes = new Map<string, Question[]>();
  questions.forEach((q, i) => {
    // The word this question shares with the most other questions is its topic
    const key = words[i].filter((w) => (count.get(w) ?? 0) >= 2).sort((a, b) => count.get(b)! - count.get(a)! || a.localeCompare(b))[0] ?? '';
    themes.set(key, [...(themes.get(key) ?? []), q]);
  });
  const sortQs = (qs: Question[]) => [...qs].sort((a, b) => Number(a.answered) - Number(b.answered) || b.likes - a.likes || Date.parse(b.at) - Date.parse(a.at));
  const named = [...themes].filter(([k]) => k).map(([k, qs]) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), questions: sortQs(qs) })).sort((a, b) => b.questions.length - a.questions.length || a.key.localeCompare(b.key));
  const rest = themes.get('');
  return rest?.length ? [...named, { key: '', label: named.length ? 'Other questions' : 'Questions', questions: sortQs(rest) }] : named;
}

// Kept in AppConfig, not with the cached AI answers: those are wiped whenever the timezone changes or
// posts are removed, and a comment read should outlive both
const keyOf = (userId: string, scopeKey: string) => `questions:${userId}:${scopeKey}`;

export async function cachedQuestions(userId: string, scopeKey: string): Promise<Mined | null> {
  const row = await prisma.appConfig.findUnique({ where: { key: keyOf(userId, scopeKey) } });
  if (!row) return null;
  try {
    const mined = JSON.parse(row.value) as Mined;
    return Array.isArray(mined?.themes) && typeof mined.at === 'string' ? mined : null;
  } catch {
    return null;
  }
}

async function store(userId: string, scopeKey: string, mined: Mined) {
  const key = keyOf(userId, scopeKey);
  const value = JSON.stringify(mined);
  await prisma.appConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export const saveQuestionIdeas = async (userId: string, scopeKey: string, mined: Mined, ideas: QuestionIdea[], model: string) => {
  const next = { ...mined, ideas, ideasModel: model };
  await store(userId, scopeKey, next);
  return next;
};

// Reads the comments under the busiest recent posts. Throws IgPermissionError when comments are not allowed yet.
export async function mineQuestions(userId: string, scopeKey: string, profileIds: string[]): Promise<Mined> {
  const posts = await prisma.post.findMany({
    where: { socialProfileId: { in: profileIds }, platform: 'instagram', comments: { gt: 0 }, publishedAt: { gte: new Date(Date.now() - 90 * 86_400_000) }, socialProfile: { userId, accessToken: { not: null } } },
    orderBy: [{ comments: 'desc' }, { publishedAt: 'desc' }],
    take: 15,
    select: { id: true, caption: true, socialProfile: { select: { username: true, accessToken: true } } },
  });
  const questions: Question[] = [];
  let comments = 0;
  let postsFailed = 0;
  let denied: IgPermissionError | null = null;
  for (let i = 0; i < posts.length; i += 5) {
    await Promise.all(posts.slice(i, i + 5).map(async (p) => {
      try {
        const me = p.socialProfile.username.toLowerCase();
        const raw = await getInstagramComments(p.socialProfile.accessToken!, p.id);
        for (const c of raw) {
          if ((c.username ?? '').toLowerCase() === me || !c.text) continue;
          comments++;
          if (!isQuestion(c.text)) continue;
          questions.push({
            id: c.id,
            text: c.text.replace(/\s+/g, ' ').trim().slice(0, 400),
            username: c.username ?? 'someone',
            at: c.timestamp,
            likes: c.like_count ?? 0,
            answered: (c.replies?.data ?? []).some((r) => (r.username ?? '').toLowerCase() === me),
            postId: p.id,
            postCaption: p.caption.replace(/\s+/g, ' ').trim().slice(0, 80),
          });
        }
      } catch (error) {
        if (error instanceof IgPermissionError) denied = error;
        postsFailed++;
      }
    }));
    if (denied) throw denied;
  }
  // Every post failed for some other reason: say so instead of showing an empty, confident "no questions"
  if (posts.length && postsFailed === posts.length) throw new Error('Instagram did not return comments for any post. Try again in a minute.');
  const previous = await cachedQuestions(userId, scopeKey);
  const mined: Mined = {
    at: new Date().toISOString(),
    postsRead: posts.length - postsFailed,
    postsFailed,
    comments,
    questions: questions.length,
    unanswered: questions.filter((q) => !q.answered).length,
    themes: groupQuestions(questions),
    // Ideas written from the last read stay until Sage is asked again
    ...(previous?.ideas ? { ideas: previous.ideas, ideasModel: previous.ideasModel } : {}),
  };
  await store(userId, scopeKey, mined);
  return mined;
}
