import { prisma } from '@/lib/prisma';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const FALLBACK_MODEL = 'gemini-2.5-flash';

export class AiError extends Error {
  constructor(public code: 'no_key' | 'no_data' | 'api', message: string) {
    super(message);
  }
}

// ---------- Key and model ----------

type GeminiConfig = { apiKey: string; model: string };

export async function getGeminiConfig(userId: string): Promise<GeminiConfig> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { geminiApiKey: true, geminiModel: true } });
  const apiKey = user?.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError('no_key', 'Add your Gemini API key in Settings to use AI features.');
  return { apiKey, model: user?.geminiModel || process.env.GEMINI_MODEL || FALLBACK_MODEL };
}

function versionScore(name: string) {
  // gemini-2.5-flash -> 2.5, gemini-3-flash -> 3
  const match = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

// Picks the newest stable Flash model this key can use, so retired model names never break the app
export async function pickModel(apiKey: string) {
  const res = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey }, cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiError('api', explainGeminiError(res.status, body));

  const models: { name: string; supportedGenerationMethods?: string[] }[] = body.models ?? [];
  const candidates = models
    .map((m) => ({ id: m.name.replace(/^models\//, ''), methods: m.supportedGenerationMethods ?? [] }))
    .filter((m) => m.methods.includes('generateContent'))
    .filter((m) => /^gemini-[\d.]+-flash$/.test(m.id) || /^gemini-[\d.]+-flash-\d{3}$/.test(m.id))
    .sort((a, b) => versionScore(b.id) - versionScore(a.id) || a.id.length - b.id.length);

  return candidates[0]?.id ?? FALLBACK_MODEL;
}

function explainGeminiError(status: number, body: { error?: { message?: string; status?: string } }) {
  const message = body?.error?.message || `Gemini request failed (${status})`;
  if (status === 400 && /api key not valid/i.test(message)) return 'That API key is not valid. Copy it again from Google AI Studio.';
  if (status === 403) return `Gemini refused the key: ${message}`;
  if (status === 429) return 'Gemini quota reached on every available model. Wait a minute (or until tomorrow on the free tier) and try again.';
  if (status === 503) return 'Google\'s Gemini servers are overloaded right now (this is on Google\'s side, not your key). Try again in a few minutes.';
  return message;
}

// Other models to try when the chosen one is overloaded or out of free quota
const BACKUP_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
const RETRYABLE = new Set([429, 500, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generate(config: GeminiConfig, prompt: string, options: { json?: boolean; system?: string; history?: ChatTurn[] } = {}) {
  const contents = [
    ...(options.history ?? []).map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
    { role: 'user', parts: [{ text: prompt }] },
  ];
  const payload = JSON.stringify({
    contents,
    ...(options.system ? { systemInstruction: { parts: [{ text: options.system }] } } : {}),
    generationConfig: options.json ? { responseMimeType: 'application/json', temperature: 0.4 } : { temperature: 0.7 },
  });

  const models = [config.model, ...BACKUP_MODELS.filter((m) => m !== config.model)];
  let lastError: AiError | null = null;

  for (const model of models) {
    // One quick retry on the same model, then move on to the next one
    for (const wait of [0, 1500]) {
      if (wait) await sleep(wait);
      const res = await fetch(`${API}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
        body: payload,
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        const text: string = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
        if (text) return { text, model };
        lastError = new AiError('api', 'Gemini returned an empty answer. Try again.');
        break;
      }

      lastError = new AiError('api', explainGeminiError(res.status, body));
      // A retired or unknown model name: skip straight to the next model
      if (res.status === 404) break;
      if (!RETRYABLE.has(res.status)) throw lastError;
      console.warn(`Gemini ${model} returned ${res.status}; retrying`);
    }
  }
  throw lastError ?? new AiError('api', 'Gemini is not responding. Try again in a few minutes.');
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch {
    throw new AiError('api', 'Gemini returned something that was not valid JSON. Try again.');
  }
}

// Saves a key after proving it works; returns the model that will be used
export async function saveGeminiKey(userId: string, rawKey: string) {
  const apiKey = rawKey.trim();
  if (apiKey.length < 20) throw new AiError('api', 'That does not look like a Gemini API key. It usually starts with "AIza".');

  const model = process.env.GEMINI_MODEL || (await pickModel(apiKey));
  await generate({ apiKey, model }, 'Reply with the single word OK.');

  await prisma.user.update({ where: { id: userId }, data: { geminiApiKey: apiKey, geminiModel: model } });
  // Old results came from a different key or model; let them regenerate
  await prisma.aiResult.deleteMany({ where: { userId } });
  return model;
}

// ---------- Data context ----------

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function buildContext(userId: string) {
  const profiles = await prisma.socialProfile.findMany({ where: { userId } });
  const posts = await prisma.post.findMany({
    where: { socialProfileId: { in: profiles.map((p) => p.id) } },
    orderBy: { publishedAt: 'desc' },
    take: 40,
  });
  if (posts.length === 0) {
    throw new AiError('no_data', 'Connect an account and press Sync first, so there are posts to analyze.');
  }

  const accounts = profiles.map((p) => `${p.platform} @${p.username}: ${p.followerCount} followers`).join('\n');
  const rows = posts.map((p) => {
    const d = p.publishedAt;
    return [
      p.platform,
      p.type,
      `${DAYS[d.getUTCDay()]} ${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
      `views ${p.views}`,
      `likes ${p.likes}`,
      `comments ${p.comments}`,
      `saves ${p.saves}`,
      `shares ${p.shares}`,
      `engagement ${p.performanceScore.toFixed(1)}%`,
      `"${p.caption.replace(/\s+/g, ' ').slice(0, 140)}"`,
    ].join(' | ');
  });

  return `Accounts:\n${accounts}\n\nRecent posts, newest first (platform | type | posted | stats | caption):\n${rows.join('\n')}`;
}

const ANALYST = 'You are a sharp social media growth analyst for a solo creator. Base every point on the data given, cite concrete numbers from it, and never invent metrics that are not in the data. Engagement rate is (likes + comments + saves + shares) / reach for Instagram and (likes + comments) / views for YouTube.';

// ---------- Cached generators ----------

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

type Kind = 'insights' | 'recommendations';

export async function getCachedResult<T>(userId: string, kind: Kind) {
  const row = await prisma.aiResult.findUnique({ where: { userId_kind: { userId, kind } } });
  return row ? { items: row.content as T[], model: row.model, createdAt: row.createdAt } : null;
}

async function saveResult(userId: string, kind: Kind, items: unknown[], model: string) {
  const data = { content: items as object[], model, createdAt: new Date() };
  const row = await prisma.aiResult.upsert({
    where: { userId_kind: { userId, kind } },
    update: data,
    create: { ...data, userId, kind },
  });
  return { items, model, createdAt: row.createdAt };
}

export async function generateInsights(userId: string) {
  const config = await getGeminiConfig(userId);
  const context = await buildContext(userId);
  const { text, model } = await generate(
    config,
    `${context}\n\nFind the 5 most useful insights in this data: what is working, what is not, and why. Look at post type, posting day and time, caption style, and saves/shares versus likes.\nReturn a JSON array of objects with keys: "title" (max 8 words), "description" (2 or 3 sentences with specific numbers), "impact" ("high" | "medium" | "low"), "category" ("timing" | "content" | "engagement" | "growth").`,
    { json: true, system: ANALYST },
  );
  const items = parseJson<Insight[]>(text).slice(0, 6);
  return saveResult(userId, 'insights', items, model);
}

export async function generateRecommendations(userId: string) {
  const config = await getGeminiConfig(userId);
  const context = await buildContext(userId);
  const { text, model } = await generate(
    config,
    `${context}\n\nGive 6 specific, actionable recommendations to grow this account over the next month. Each must follow from a pattern in the data.\nReturn a JSON array of objects with keys: "title" (an action, max 8 words), "description" (2 or 3 sentences: what to do and which data point justifies it), "priority" ("high" | "medium" | "low"), "category" ("timing" | "content" | "engagement" | "growth"), "impact" (short expected result), "effort" ("low" | "medium" | "high"), "estimatedGrowth" (short, e.g. "+10% reach").`,
    { json: true, system: ANALYST },
  );
  const items = parseJson<Omit<AiRecommendation, 'id'>[]>(text)
    .slice(0, 8)
    .map((r, i) => ({ ...r, id: `rec-${i}` }));
  return saveResult(userId, 'recommendations', items, model);
}

// ---------- Chat ----------

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export async function chatWithAssistant(userId: string, history: ChatTurn[], message: string) {
  const config = await getGeminiConfig(userId);
  let context: string;
  try {
    context = await buildContext(userId);
  } catch (error) {
    if (error instanceof AiError && error.code === 'no_data') context = 'No posts have been synced yet.';
    else throw error;
  }
  const { text } = await generate(config, message, {
    history: history.slice(-10),
    system: `${ANALYST}\nYou are chatting inside the creator's analytics dashboard. Keep answers short and practical (under 150 words), use plain text with simple dashes for lists, and refer to their real numbers.\n\n${context}`,
  });
  return text;
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
  const config = await getGeminiConfig(userId);
  const data = await getPostWithBenchmarks(userId, postId);
  if (!data) throw new AiError('no_data', 'Post not found. Try syncing again.');
  const { post, benchmarks: b } = data;

  const line = (label: string, value: number, average: number) =>
    `${label}: ${Math.round(value)} (account average ${Math.round(average)})`;
  const { text, model } = await generate(
    config,
    `Analyze this single ${post.platform} ${post.type} for the creator @${post.socialProfile.username}.
Posted: ${post.publishedAt.toISOString()} (${DAYS[post.publishedAt.getUTCDay()]}, UTC)
Caption: "${post.caption.slice(0, 1500)}"
${line('Views', post.views, b.views)}
${line('Reach', post.reach ?? 0, b.reach)}
${line('Likes', post.likes, b.likes)}
${line('Comments', post.comments, b.comments)}
${line('Saves', post.saves, b.saves)}
${line('Shares', post.shares, b.shares)}
Engagement: ${post.performanceScore.toFixed(1)}% (account average ${b.engagement.toFixed(1)}%)
Rank by engagement: ${b.rank} of ${b.posts} synced posts

Judge the caption (hook, clarity, call to action, hashtags), the format and the timing against these numbers. You cannot see the image or video, so do not describe visuals.
Return a JSON object with keys: "verdict" (one sentence on how it performed vs the account average), "whyItPerformed" (2-4 short bullet strings citing numbers), "improve" (2-4 specific changes for a similar post), "nextPostIdeas" (3 concrete follow-up post ideas), "bestFor" (one short phrase: what this post is good at, e.g. "reach", "saves", "conversation").`,
    { json: true, system: ANALYST },
  );
  const analysis = parseJson<PostAnalysis>(text);

  const kind = `post:${postId}`;
  const row = await prisma.aiResult.upsert({
    where: { userId_kind: { userId, kind } },
    update: { content: analysis as object, model, createdAt: new Date() },
    create: { userId, kind, content: analysis as object, model },
  });
  return { analysis, model: row.model, createdAt: row.createdAt };
}

export async function getCachedPostAnalysis(userId: string, postId: string) {
  const row = await prisma.aiResult.findUnique({ where: { userId_kind: { userId, kind: `post:${postId}` } } });
  return row ? { analysis: row.content as PostAnalysis, model: row.model, createdAt: row.createdAt } : null;
}
