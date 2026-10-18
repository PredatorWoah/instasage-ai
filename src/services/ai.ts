import { prisma } from '@/lib/prisma';
import { AiError, generate, getAiConfig, parseJson, type ChatTurn } from '@/services/llm';
import { analysisToPrompt, buildAnalysis, localTime } from '@/services/analysis';
import { competitorsToPrompt } from '@/services/competitors';

export { AiError, type ChatTurn };

type Scope = { key: string; profileIds: string[] };

const ANALYST = `You are a sharp, honest social media strategist for a solo creator. Base every point on the numbers given, cite them, and never invent metrics that are not in the data. When a sample is small (under 3 posts), say so instead of overclaiming. Engagement rate is (likes + comments + saves + shares) / reach for Instagram and (likes + comments) / views for YouTube. Saves and shares signal content people value; comments signal conversation.`;

export type CreatorProfile = { niche?: string; audience?: string; goals?: string; postsPerWeek?: number; voice?: string; avoid?: string; language?: string };

// What the creator told us about themselves, as lines for a prompt
export function creatorProfileText(bio: string | null | undefined, p: CreatorProfile | null | undefined) {
  const lines = [
    bio?.trim() && `In their own words: ${bio.trim().slice(0, 600)}`,
    p?.niche && `Niche: ${p.niche}`,
    p?.audience && `Who they want to reach: ${p.audience}`,
    p?.goals && `Goals: ${p.goals}`,
    p?.postsPerWeek && `They can realistically make ${p.postsPerWeek} posts a week. Never plan more than that.`,
    p?.voice && `Their voice and style: ${p.voice}`,
    p?.avoid && `Topics and styles to avoid: ${p.avoid}`,
    p?.language && `Write captions, hooks and scripts in: ${p.language}`,
  ].filter(Boolean);
  return lines.length ? `## About the creator\n${lines.join('\n')}\n` : '';
}

// Ideas from the board that became real posts, and how each did against the average
async function ideaResults(userId: string, profileIds: string[]) {
  const [ideas, avg] = await Promise.all([
    prisma.savedIdea.findMany({
      where: { userId, postId: { not: null }, post: { socialProfileId: { in: profileIds } } },
      include: { post: { select: { views: true, performanceScore: true, type: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    }),
    prisma.post.aggregate({ where: { socialProfileId: { in: profileIds }, isBoosted: false }, _avg: { views: true } }),
  ]);
  const base = avg._avg.views ?? 0;
  const rows = ideas.filter((i) => i.post).map((i) => {
    const lift = base ? Math.round(((i.post!.views - base) / base) * 100) : 0;
    return `"${i.title.slice(0, 90)}" (${i.post!.type}): ${i.post!.views} views (${lift >= 0 ? '+' : ''}${lift}% vs average), ${i.post!.performanceScore.toFixed(1)}% engagement`;
  });
  return rows.length ? `\n## Ideas from their board that they posted, and how they did\nLean into what worked here and learn from what did not.\n${rows.join('\n')}` : '';
}

// Bio, creator profile and numbers, plus competitors and past idea results for the strategy features
async function context(userId: string, profileIds: string[], timeZone: string, withRivals = false) {
  const [analysis, rivals, user, results] = await Promise.all([
    buildAnalysis(profileIds, timeZone),
    withRivals ? competitorsToPrompt(userId) : Promise.resolve(''),
    prisma.user.findUnique({ where: { id: userId }, select: { bio: true, creatorProfile: true } }),
    withRivals ? ideaResults(userId, profileIds) : Promise.resolve(''),
  ]);
  if (analysis.totals.posts === 0) {
    throw new AiError('no_data', 'Connect an account and press Sync first, so there are posts to analyze.');
  }
  return creatorProfileText(user?.bio, user?.creatorProfile as CreatorProfile | null) + analysisToPrompt(analysis) + rivals + results;
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
  const config = await getAiConfig(userId, 'insights');
  const data = await context(userId, scope.profileIds, config.timeZone);
  const { text, model } = await generate(
    config,
    `${data}\n\nFind the 5 most useful insights in these numbers: what is working, what is not, and why. Prefer the biggest differences between groups (format, weekday, time of day, caption style, hashtags, calls to action) and any momentum change. Every insight must quote the numbers behind it.\nReturn a JSON object: {"items": [{"title": max 8 words, "description": 2 or 3 sentences with specific numbers, "impact": "high" | "medium" | "low", "category": "timing" | "content" | "engagement" | "growth"}]}`,
    { json: true, system: ANALYST, feature: 'insights' },
  );
  return saveList(userId, 'insights', scope.key, items<Insight>(text).slice(0, 6), model);
}

export async function generateRecommendations(userId: string, scope: Scope) {
  const config = await getAiConfig(userId, 'recommendations');
  const data = await context(userId, scope.profileIds, config.timeZone);
  const { text, model } = await generate(
    config,
    `${data}\n\nGive 6 quick wins: specific actions this creator can take this week, each following from a pattern in the numbers above.\nReturn a JSON object: {"items": [{"title": an action, max 8 words, "description": 2 or 3 sentences (what to do and which number justifies it), "priority": "high" | "medium" | "low", "category": "timing" | "content" | "engagement" | "growth", "impact": short expected result, "effort": "low" | "medium" | "high", "estimatedGrowth": short, e.g. "+10% reach"}]}`,
    { json: true, system: ANALYST, feature: 'recommendations' },
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
  const config = await getAiConfig(userId, 'plan');
  const data = await context(userId, scope.profileIds, config.timeZone, true);
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
    { json: true, system: ANALYST, long: true, feature: 'plan' },
  );
  const plan = parseJson<GamePlan>(text);
  if (!plan.headline || !Array.isArray(plan.weeks)) throw new AiError('api', 'The game plan came back incomplete. Try again.', true);
  const row = await write(userId, `plan:${scope.key}`, plan, model);
  return { plan, model, createdAt: row.createdAt };
}

// ---------- Competitor takeaways ----------

export type CompetitorTakeaways = {
  summary: string;
  theyDoBetter: { title: string; detail: string }[];
  youDoBetter: { title: string; detail: string }[];
  steal: { idea: string; from: string; how: string }[];
  avoid: string[];
};

export async function getCachedTakeaways(userId: string) {
  const row = await read(userId, 'competitors');
  return row ? { takeaways: row.content as CompetitorTakeaways, model: row.model, createdAt: row.createdAt } : null;
}

export async function generateCompetitorTakeaways(userId: string, scope: Scope) {
  const config = await getAiConfig(userId, 'competitors');
  const rivals = await competitorsToPrompt(userId);
  if (!rivals) throw new AiError('no_data', 'Add at least one competitor first.');
  const data = await context(userId, scope.profileIds, config.timeZone).catch((error) => {
    if (error instanceof AiError && error.code === 'no_data') return 'The creator has no synced posts yet.';
    throw error;
  });
  const { text, model } = await generate(
    config,
    `${data}${rivals}

Compare the creator with these competitors. Compare like with like: for competitors only likes and comments per follower are known, so judge the creator on the same basis (their likes and comments vs followers), not on reach based engagement. Be specific and cite numbers.
Return a JSON object: {"summary": 2 or 3 sentences on where the creator stands, "theyDoBetter": 2 to 4 [{"title", "detail"}], "youDoBetter": 2 to 3 [{"title", "detail"}], "steal": 3 to 5 concrete ideas worth adapting [{"idea", "from": "@username", "how": how to make it the creator's own}], "avoid": 2 or 3 things competitors do that the creator should not copy}`,
    { json: true, system: ANALYST, feature: 'competitors' },
  );
  const takeaways = parseJson<CompetitorTakeaways>(text);
  const row = await write(userId, 'competitors', takeaways, model);
  return { takeaways, model, createdAt: row.createdAt };
}

// ---------- Export for a chat app (ChatGPT, Claude, Gemini...) ----------

export type ExportGoal = 'plan' | 'review' | 'ideas' | 'ask';

const EXPORT_TASKS: Record<ExportGoal, string> = {
  plan: `Build my 30-day game plan. Be direct and specific: name formats, days, local times and topics, and tie every call to a number in my data. If the data is thin for something, say what to test instead of pretending.

Give me, in this order:
1. Where I stand: one punchy sentence, then 2 or 3 sentences on my biggest growth lever and biggest leak, with numbers.
2. Keep doing: 3 to 5 things that work and must continue (each with the number that proves it).
3. Stop doing: 3 to 5 things to stop or avoid (each with the number that proves it).
4. Content pillars: 3 or 4, each with a share of my posts and the formats to use.
5. Posting schedule: 3 to 6 weekly slots (day, time in my timezone, format, why).
6. Week by week: 4 weeks, each with a theme, a goal and 3 to 5 posts (day, format, one concrete idea, the opening hook line).
7. Experiments: 2 or 3 tests (hypothesis, how to run it, the number that decides it).
8. Targets: 3 or 4 numbers to hit in 30 days, with where I am now.`,
  review: `Tell me what is working and what is not. Find the 5 most useful insights in these numbers, preferring the biggest differences between groups (format, weekday, time of day, caption style, hashtags, calls to action) and any momentum change. Quote the numbers behind each one. Then give me 6 quick wins I can do this week, each with effort (low, medium, high) and the expected effect.`,
  ideas: `Be my brainstorming partner. Start with 10 specific post ideas for the next two weeks: for each give the format, a hook line, why it should work for my audience (cite my numbers) and the best slot to post it. Then ask me one sharp question to push the best 3 further. Push back honestly if one of my own ideas looks weak for my audience.`,
  ask: `I have a question about my account. First read my data below, then answer my question using my real numbers. My question: `,
};

export async function buildExportText(userId: string, scope: Scope, goal: ExportGoal) {
  const config = await getAiConfig(userId).catch(() => null);
  const timeZone = config?.timeZone ?? (await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }))?.timezone ?? 'UTC';
  const data = await context(userId, scope.profileIds, timeZone, true);
  const stamp = new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'long' }).format(new Date());

  return [
    '# Task',
    ANALYST,
    '',
    EXPORT_TASKS[goal],
    '',
    'Do not invent numbers that are not in the data below. If you need something I have not given you (my niche, goals, what I can realistically film), ask me one short question first.',
    '',
    `# My data (exported from InstaSage on ${stamp})`,
    'Everything below is already worked out for you: patterns by format, weekday, hour, caption style and hashtags, momentum, posting cadence, top and weakest posts, audience and competitors. Times are in my local timezone.',
    '',
    data,
  ].join('\n');
}

// ---------- Write it for me (idea board) ----------

export type DraftKind = 'script' | 'carousel' | 'caption';

const DRAFT_TASKS: Record<DraftKind, (yt: boolean) => string> = {
  script: (yt) => yt
    ? 'Write a ready-to-film video script: a title (and 2 alternatives), a thumbnail idea, the first 10 seconds word for word, the beats in order with rough timings, and the call to action. Keep spoken lines natural.'
    : 'Write a ready-to-film reel script: the on-screen hook for the first 2 seconds, then each beat in order with what to show and what to say (rough timings, 15 to 45 seconds total), the on-screen text, and the call to action. Keep spoken lines natural.',
  carousel: () => 'Write a carousel outline: 7 to 10 slides, each with a short headline and one or two lines of supporting text, a cover slide that stops the scroll, and a last slide with a call to action that invites saves or shares.',
  caption: (yt) => yt
    ? 'Write the video description: a first line that works in search, 3 to 5 short paragraphs, timestamps placeholders if useful, and 3 to 5 relevant tags.'
    : 'Write the caption: a first line that works as a hook, 2 to 4 short lines of value, a call to action, then 3 to 5 relevant hashtags (fewer is better for this account unless the numbers say otherwise). Give 2 alternative first lines.',
};

export async function writeForIdea(userId: string, scope: Scope & { mode?: string }, ideaId: string, kind: DraftKind) {
  const idea = await prisma.savedIdea.findFirst({ where: { id: ideaId, userId } });
  if (!idea) throw new AiError('no_data', 'That idea no longer exists.');
  const config = await getAiConfig(userId, 'writer');
  const data = await context(userId, scope.profileIds, config.timeZone).catch(async (error) => {
    if (!(error instanceof AiError && error.code === 'no_data')) throw error;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { bio: true, creatorProfile: true } });
    return creatorProfileText(user?.bio, user?.creatorProfile as CreatorProfile | null) || 'No synced posts yet.';
  });
  const yt = scope.mode === 'youtube';
  const { text } = await generate(
    config,
    `Idea: ${idea.title}${idea.format ? `\nFormat: ${idea.format}` : ''}${idea.notes ? `\nNotes: ${idea.notes.slice(0, 1500)}` : ''}

${DRAFT_TASKS[kind](yt)}

Match the creator's voice and what already works for this account (cite nothing, just use it). Reply in short Markdown with ### headings. No preamble.`,
    { system: `${ANALYST}\nYou are also the creator's scriptwriter: punchy, specific, never generic.\n\n${data}`, feature: 'writer' },
  );
  const drafts = { ...((idea.drafts as Record<string, string> | null) ?? {}), [kind]: text };
  await prisma.savedIdea.update({ where: { id: idea.id }, data: { drafts } });
  return { kind, text };
}

// ---------- Chat widget ----------

export async function chatWithAssistant(userId: string, scope: Scope, history: ChatTurn[], message: string) {
  const config = await getAiConfig(userId, 'chat');
  let data: string;
  try {
    data = await context(userId, scope.profileIds, config.timeZone);
  } catch (error) {
    if (error instanceof AiError && error.code === 'no_data') data = 'No posts have been synced yet.';
    else throw error;
  }
  const { text } = await generate(config, message, {
    history: history.slice(-10),
    feature: 'chat',
    system: `${ANALYST}\nYou are Sage, chatting inside the creator's analytics dashboard. Keep answers short and practical (under 150 words), plain text, and refer to their real numbers.\n\n${data}`,
  });
  return text;
}

// ---------- Brainstorm (Ideas Studio) ----------

export async function brainstormReply(userId: string, scope: Scope, history: ChatTurn[], message: string) {
  const config = await getAiConfig(userId, 'brainstorm');
  const [data, plan, saved] = await Promise.all([
    context(userId, scope.profileIds, config.timeZone, true).catch((error) => {
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

  return generate(config, message, { history: history.slice(-16), system, feature: 'brainstorm' });
}

// ---------- Monthly report story ----------

export type ReportStory = { headline: string; summary: string; wins: string[]; watchouts: string[]; nextMonth: string[] };

export async function getCachedReportStory(userId: string, scopeKey: string, month: string) {
  const row = await read(userId, `report:${month}:${scopeKey}`);
  return row ? { story: row.content as ReportStory, model: row.model, createdAt: row.createdAt } : null;
}

export async function generateReportStory(userId: string, scopeKey: string, month: string, reportText: string) {
  const config = await getAiConfig(userId, 'report');
  const { text, model } = await generate(
    config,
    `${reportText}\n\nWrite this month's performance review for the creator. Compare with the previous month where numbers exist.\nReturn a JSON object: {"headline": one sentence, "summary": 3 or 4 sentences with numbers, "wins": 3 short bullet strings, "watchouts": 2 or 3 short bullet strings, "nextMonth": 3 specific actions for next month}`,
    { json: true, system: ANALYST, feature: 'report' },
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
  const post = await prisma.post.findFirst({
    where: { id: postId, socialProfile: { userId } },
    include: { socialProfile: true, snapshots: { orderBy: { hours: 'asc' }, select: { hours: true, views: true, likes: true, comments: true, saves: true, shares: true } } },
  });
  if (!post) return null;

  const siblings = await prisma.post.findMany({
    where: { socialProfileId: post.socialProfileId },
    select: { id: true, type: true, views: true, reach: true, likes: true, comments: true, saves: true, shares: true, performanceScore: true, avgWatchMs: true, skipRate: true },
  });
  const avg = (rows: typeof siblings, pick: (p: (typeof siblings)[number]) => number) =>
    rows.length ? rows.reduce((a, p) => a + pick(p), 0) / rows.length : 0;
  const rank = [...siblings].sort((a, b) => b.performanceScore - a.performanceScore).findIndex((p) => p.id === post.id) + 1;
  const watched = siblings.filter((p) => p.avgWatchMs != null);
  const skipped = siblings.filter((p) => p.skipRate != null);

  // Views at about a day old, against the account's other posts at the same age
  const nearDay = (snaps: { hours: number; views: number }[]) =>
    snaps.filter((x) => x.hours >= 18 && x.hours <= 36).sort((a, b) => Math.abs(a.hours - 24) - Math.abs(b.hours - 24))[0] ?? null;
  const own = nearDay(post.snapshots);
  const others = await prisma.postSnapshot.findMany({
    where: { post: { socialProfileId: post.socialProfileId }, postId: { not: post.id }, hours: { gte: 18, lte: 36 } },
    select: { postId: true, hours: true, views: true },
  });
  const perPost = new Map<string, { hours: number; views: number }[]>();
  for (const o of others) perPost.set(o.postId, [...(perPost.get(o.postId) ?? []), o]);
  const peers = [...perPost.values()].map(nearDay).filter((x): x is { hours: number; views: number } => !!x);

  return {
    post,
    benchmarks: {
      posts: siblings.length,
      rank,
      views: avg(siblings, (p) => p.views),
      reach: avg(siblings, (p) => p.reach ?? 0),
      likes: avg(siblings, (p) => p.likes),
      comments: avg(siblings, (p) => p.comments),
      saves: avg(siblings, (p) => p.saves),
      shares: avg(siblings, (p) => p.shares),
      engagement: avg(siblings, (p) => p.performanceScore),
      avgWatchMs: watched.length ? avg(watched, (p) => p.avgWatchMs!) : null,
      skipRate: skipped.length ? avg(skipped, (p) => p.skipRate!) : null,
      at24: own ? { views: own.views, hours: own.hours, usual: peers.length >= 2 ? Math.round(peers.reduce((a, x) => a + x.views, 0) / peers.length) : null, compared: peers.length } : null,
    },
  };
}

export async function analyzePost(userId: string, postId: string) {
  const config = await getAiConfig(userId, 'post');
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
Engagement: ${post.performanceScore.toFixed(1)}% (account average ${b.engagement.toFixed(1)}%)${post.avgWatchMs != null ? `\nAverage watch time: ${(post.avgWatchMs / 1000).toFixed(1)}s per play${b.avgWatchMs ? ` (account reels average ${(b.avgWatchMs / 1000).toFixed(1)}s)` : ''}` : ''}${post.skipRate != null ? `\nSkip rate: ${post.skipRate.toFixed(0)}%${b.skipRate != null ? ` (account average ${b.skipRate.toFixed(0)}%)` : ''}` : ''}${b.at24 ? `\nViews at ${b.at24.hours} hours old: ${b.at24.views}${b.at24.usual != null ? ` (other posts at that age: ${b.at24.usual})` : ''}` : ''}
Rank by engagement: ${b.rank} of ${b.posts} synced posts${post.isBoosted ? '\nThis post was boosted (paid promotion). The numbers above are organic only; paid views and likes are not included, so do not call it underperforming for that reason.' : ''}

Judge the caption (hook, clarity, call to action, hashtags), the format and the timing against these numbers. You cannot see the image or video, so do not describe visuals.
Return a JSON object with keys: "verdict" (one sentence on how it performed vs the account average), "whyItPerformed" (2-4 short bullet strings citing numbers), "improve" (2-4 specific changes for a similar post), "nextPostIdeas" (3 concrete follow-up post ideas), "bestFor" (one short phrase: what this post is good at, e.g. "reach", "saves", "conversation").`,
    { json: true, system: ANALYST, feature: 'post' },
  );
  const analysis = parseJson<PostAnalysis>(text);
  const row = await write(userId, `post:${postId}`, analysis, model);
  return { analysis, model: row.model, createdAt: row.createdAt };
}

export async function getCachedPostAnalysis(userId: string, postId: string) {
  const row = await read(userId, `post:${postId}`);
  return row ? { analysis: row.content as PostAnalysis, model: row.model, createdAt: row.createdAt } : null;
}
