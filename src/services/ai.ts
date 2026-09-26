import { prisma } from '@/lib/prisma';
import { AiError, generate, getAiConfig, parseJson, type ChatTurn } from '@/services/llm';
import { analysisToPrompt, buildAnalysis, localTime } from '@/services/analysis';

export { AiError, type ChatTurn };

type Scope = { key: string; profileIds: string[] };

const ANALYST = `You are a sharp, honest social media strategist for a solo creator. Base every point on the numbers given, cite them, and never invent metrics that are not in the data. When a sample is small (under 3 posts), say so instead of overclaiming. Engagement rate is (likes + comments + saves + shares) / reach for Instagram and (likes + comments) / views for YouTube. Saves and shares signal content people value; comments signal conversation.`;

async function context(profileIds: string[], timeZone: string) {
  const analysis = await buildAnalysis(profileIds, timeZone);
  if (analysis.totals.posts === 0) {
    throw new AiError('no_data', 'Connect an account and press Sync first, so there are posts to analyze.');
  }
  return analysisToPrompt(analysis);
}

// JSON answers come back as an object; lists sit under "items"
function items<T>(text: string): T[] {
  const parsed = parseJson<{ items?: T[] } | T[]>(text);
  const list = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(list)) throw new AiError('api', 'The AI answer was missing its list. Try again.', true);
  return list;
}

// ---------- Cache ----------

const read = (userId: string, kind: string) => prisma.aiResult.findUnique({ where: { userId_kind: { userId, kind } } });

async function write(userId: string, kind: string, content: unknown, model: string) {
  const data = { content: content as object, model, createdAt: new Date() };
  return prisma.aiResult.upsert({ where: { userId_kind: { userId, kind } }, update: data, create: { ...data, userId, kind } });
}

type ListKind = 'insights' | 'recommendations';

export async function getCachedResult<T>(userId: string, kind: ListKind, scopeKey: string) {
  const row = await read(userId, `${kind}:${scopeKey}`);
  return row ? { items: row.content as T[], model: row.model, createdAt: row.createdAt } : null;
}

async function saveList(userId: string, kind: ListKind, scopeKey: string, list: unknown[], model: string) {
  const row = await write(userId, `${kind}:${scopeKey}`, list, model);
  return { items: list, model, createdAt: row.createdAt };
}

// Times in cached answers were worded for the old timezone
export async function clearTimedResults(userId: string) {
  await prisma.aiResult.deleteMany({ where: { userId, NOT: { kind: { startsWith: 'report:' } } } });
}

// ---------- Insights and quick wins ----------

export type Insight = { title: string; description: string; impact: 'high' | 'medium' | 'low'; category: string };
export type AiRecommendation = {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'timing' | 'content' | 'engagement' | 'growth';
  impact: string;
  effort: 'low' | 'medium' | 'high';
  estimatedGrowth: string;
};

export async function generateInsights(userId: string, scope: Scope) {
  const config = await getAiConfig(userId);
  const data = await context(scope.profileIds, config.timeZone);
  const { text, model } = await generate(
    config,
    `${data}\n\nFind the 5 most useful insights in these numbers: what is working, what is not, and why. Prefer the biggest differences between groups (format, weekday, time of day, caption style, hashtags, calls to action) and any momentum change. Every insight must quote the numbers behind it.\nReturn a JSON object: {"items": [{"title": max 8 words, "description": 2 or 3 sentences with specific numbers, "impact": "high" | "medium" | "low", "category": "timing" | "content" | "engagement" | "growth"}]}`,
    { json: true, system: ANALYST },
  );
  return saveList(userId, 'insights', scope.key, items<Insight>(text).slice(0, 6), model);
}

export async function generateRecommendations(userId: string, scope: Scope) {
  const config = await getAiConfig(userId);
  const data = await context(scope.profileIds, config.timeZone);
  const { text, model } = await generate(
    config,
    `${data}\n\nGive 6 quick wins: specific actions this creator can take this week, each following from a pattern in the numbers above.\nReturn a JSON object: {"items": [{"title": an action, max 8 words, "description": 2 or 3 sentences (what to do and which number justifies it), "priority": "high" | "medium" | "low", "category": "timing" | "content" | "engagement" | "growth", "impact": short expected result, "effort": "low" | "medium" | "high", "estimatedGrowth": short, e.g. "+10% reach"}]}`,
    { json: true, system: ANALYST },
  );
  const list = items<Omit<AiRecommendation, 'id'>>(text).slice(0, 8).map((r, i) => ({ ...r, id: `rec-${i}` }));
  return saveList(userId, 'recommendations', scope.key, list, model);
}

// ---------- Game plan ----------

export type GamePlan = {
  headline: string;
  diagnosis: string;
  keep: { title: string; why: string }[];
  stop: { title: string; why: string }[];
  pillars: { name: string; description: string; share: number; formats: string }[];
  schedule: { day: string; time: string; format: string; why: string }[];
  weeks: { week: number; theme: string; goal: string; posts: { day: string; format: string; idea: string; hook: string }[] }[];
  experiments: { title: string; hypothesis: string; how: string; measure: string }[];
  targets: { metric: string; now: string; target: string }[];
};

export async function getCachedPlan(userId: string, scopeKey: string) {
  const row = await read(userId, `plan:${scopeKey}`);
  return row ? { plan: row.content as GamePlan, model: row.model, createdAt: row.createdAt } : null;
}

export async function generateGamePlan(userId: string, scope: Scope) {
  const config = await getAiConfig(userId);
  const data = await context(scope.profileIds, config.timeZone);
  const { text, model } = await generate(
    config,
    `${data}

Build this creator's game plan for the next 30 days. Be direct and specific: name formats, days, local times and topics, and tie every call to a number above. If the data is thin for something, say what to test instead of pretending.

Return a JSON object with exactly these keys:
"headline": one punchy sentence on where the account stands right now,
"diagnosis": 2 or 3 sentences: the biggest growth lever and the biggest leak, with numbers,
"keep": 3 to 5 things that are working and must continue [{"title", "why"}],
"stop": 3 to 5 things to stop or avoid, the don'ts [{"title", "why"}],
"pillars": 3 or 4 content pillars built from the best performing topics [{"name", "description", "share": percent of posts as a number, "formats": e.g. "Reels, carousels"}],
"schedule": the weekly posting slots to use, 3 to 6 of them [{"day": "Mon".."Sun", "time": e.g. "7 PM", "format", "why"}],
"weeks": 4 weeks [{"week": 1..4, "theme", "goal", "posts": 3 to 5 posts [{"day", "format", "idea": one concrete post idea, "hook": the first line or on-screen hook}]}],
"experiments": 2 or 3 tests to run [{"title", "hypothesis", "how", "measure": which number decides it}],
"targets": 3 or 4 targets for the 30 days [{"metric", "now": current value, "target"}]`,
    { json: true, system: ANALYST, long: true },
  );
  const plan = parseJson<GamePlan>(text);
  if (!plan.headline || !Array.isArray(plan.weeks)) throw new AiError('api', 'The game plan came back incomplete. Try again.', true);
  const row = await write(userId, `plan:${scope.key}`, plan, model);
  return { plan, model, createdAt: row.createdAt };
}

// ---------- Chat widget ----------

export async function chatWithAssistant(userId: string, scope: Scope, history: ChatTurn[], message: string) {
  const config = await getAiConfig(userId);
  let data: string;
  try {
    data = await context(scope.profileIds, config.timeZone);
  } catch (error) {
    if (error instanceof AiError && error.code === 'no_data') data = 'No posts have been synced yet.';
    else throw error;
  }
  const { text } = await generate(config, message, {
    history: history.slice(-10),
    system: `${ANALYST}\nYou are Sage, chatting inside the creator's analytics dashboard. Keep answers short and practical (under 150 words), plain text, and refer to their real numbers.\n\n${data}`,
  });
  return text;
}

// ---------- Brainstorm (Ideas Studio) ----------

export async function brainstormReply(userId: string, scope: Scope, history: ChatTurn[], message: string) {
  const config = await getAiConfig(userId);
  const [data, plan, saved] = await Promise.all([
    context(scope.profileIds, config.timeZone).catch((error) => {
      if (error instanceof AiError && error.code === 'no_data') return 'No posts have been synced yet, so ideas cannot lean on past results.';
      throw error;
    }),
    getCachedPlan(userId, scope.key),
    prisma.savedIdea.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 15, select: { title: true, status: true } }),
  ]);

  const system = `${ANALYST}
You are Sage, the creator's brainstorming partner in their Ideas Studio. Think with them, not at them:
- Be concrete: give hooks, formats, shot lists, caption openers, series names. No generic advice like "post consistently".
- Ground ideas in what already works for this account (the numbers below) and say which number backs an idea.
- Push back honestly when an idea is weak for this audience, and offer a stronger angle.
- When asked for many ideas, number them. Use short Markdown: **bold**, bullet lists, and ### headings for longer answers.
- Keep it tight. End with a sharp follow-up question or next step when it helps.
${plan ? `\nTheir current 30-day game plan: ${plan.plan.headline} Pillars: ${plan.plan.pillars.map((p) => p.name).join(', ')}.` : ''}
${saved.length ? `\nIdeas already on their board (do not repeat them): ${saved.map((s) => `${s.title} [${s.status}]`).join('; ')}` : ''}

${data}`;

  return generate(config, message, { history: history.slice(-16), system });
}

// ---------- Monthly report story ----------

export type ReportStory = { headline: string; summary: string; wins: string[]; watchouts: string[]; nextMonth: string[] };

export async function getCachedReportStory(userId: string, scopeKey: string, month: string) {
  const row = await read(userId, `report:${month}:${scopeKey}`);
  return row ? { story: row.content as ReportStory, model: row.model, createdAt: row.createdAt } : null;
}

export async function generateReportStory(userId: string, scopeKey: string, month: string, reportText: string) {
  const config = await getAiConfig(userId);
  const { text, model } = await generate(
    config,
    `${reportText}\n\nWrite this month's performance review for the creator. Compare with the previous month where numbers exist.\nReturn a JSON object: {"headline": one sentence, "summary": 3 or 4 sentences with numbers, "wins": 3 short bullet strings, "watchouts": 2 or 3 short bullet strings, "nextMonth": 3 specific actions for next month}`,
    { json: true, system: ANALYST },
  );
  const story = parseJson<ReportStory>(text);
  const row = await write(userId, `report:${month}:${scopeKey}`, story, model);
  return { story, model, createdAt: row.createdAt };
}

// ---------- Single post analysis ----------

export type PostAnalysis = {
  verdict: string;
  whyItPerformed: string[];
  improve: string[];
  nextPostIdeas: string[];
  bestFor: string;
};

export async function getPostWithBenchmarks(userId: string, postId: string) {
  const post = await prisma.post.findFirst({ where: { id: postId, socialProfile: { userId } }, include: { socialProfile: true } });
  if (!post) return null;

  const siblings = await prisma.post.findMany({
    where: { socialProfileId: post.socialProfileId },
    select: { id: true, views: true, reach: true, likes: true, comments: true, saves: true, shares: true, performanceScore: true },
  });
  const avg = (pick: (p: (typeof siblings)[number]) => number) =>
    siblings.length ? siblings.reduce((a, p) => a + pick(p), 0) / siblings.length : 0;
  const rank = [...siblings].sort((a, b) => b.performanceScore - a.performanceScore).findIndex((p) => p.id === post.id) + 1;

  return {
    post,
    benchmarks: {
      posts: siblings.length,
      rank,
      views: avg((p) => p.views),
      reach: avg((p) => p.reach ?? 0),
      likes: avg((p) => p.likes),
      comments: avg((p) => p.comments),
      saves: avg((p) => p.saves),
      shares: avg((p) => p.shares),
      engagement: avg((p) => p.performanceScore),
    },
  };
}

export async function analyzePost(userId: string, postId: string) {
  const config = await getAiConfig(userId);
  const data = await getPostWithBenchmarks(userId, postId);
  if (!data) throw new AiError('no_data', 'Post not found. Try syncing again.');
  const { post, benchmarks: b } = data;

  const line = (label: string, value: number, average: number) =>
    `${label}: ${Math.round(value)} (account average ${Math.round(average)})`;
  const { text, model } = await generate(
    config,
    `Analyze this single ${post.platform} ${post.type} for the creator @${post.socialProfile.username}.
Posted: ${localTime(post.publishedAt, config.timeZone)} (creator's local time, timezone ${config.timeZone}; talk about times in 12-hour format and never mention UTC)
Caption: "${post.caption.slice(0, 1500)}"
${line('Views', post.views, b.views)}
${line('Reach', post.reach ?? 0, b.reach)}
${line('Likes', post.likes, b.likes)}
${line('Comments', post.comments, b.comments)}
${line('Saves', post.saves, b.saves)}
${line('Shares', post.shares, b.shares)}
Engagement: ${post.performanceScore.toFixed(1)}% (account average ${b.engagement.toFixed(1)}%)
Rank by engagement: ${b.rank} of ${b.posts} synced posts${post.isBoosted ? '\nThis post was boosted (paid promotion). The numbers above are organic only; paid views and likes are not included, so do not call it underperforming for that reason.' : ''}

Judge the caption (hook, clarity, call to action, hashtags), the format and the timing against these numbers. You cannot see the image or video, so do not describe visuals.
Return a JSON object with keys: "verdict" (one sentence on how it performed vs the account average), "whyItPerformed" (2-4 short bullet strings citing numbers), "improve" (2-4 specific changes for a similar post), "nextPostIdeas" (3 concrete follow-up post ideas), "bestFor" (one short phrase: what this post is good at, e.g. "reach", "saves", "conversation").`,
    { json: true, system: ANALYST },
  );
  const analysis = parseJson<PostAnalysis>(text);
  const row = await write(userId, `post:${postId}`, analysis, model);
  return { analysis, model: row.model, createdAt: row.createdAt };
}

export async function getCachedPostAnalysis(userId: string, postId: string) {
  const row = await read(userId, `post:${postId}`);
  return row ? { analysis: row.content as PostAnalysis, model: row.model, createdAt: row.createdAt } : null;
}
