import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';

// One interface over every AI provider the creator can plug a key into.
// Features call generate(); which model answers is a Settings choice.

export class AiError extends Error {
  constructor(public code: 'no_key' | 'no_data' | 'api', message: string, public retryable = false) {
    super(message);
  }
}

export type ProviderId = 'gemini' | 'anthropic' | 'openai' | 'openrouter';
export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export const PROVIDERS: Record<ProviderId, {
  label: string;
  company: string;
  keyPrefix: string;
  keyUrl: string;
  defaultModel: string;
  suggested: string[];
}> = {
  gemini: {
    label: 'Gemini',
    company: 'Google',
    keyPrefix: 'AIza',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-2.5-flash',
    suggested: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
  },
  anthropic: {
    label: 'Claude',
    company: 'Anthropic',
    keyPrefix: 'sk-ant-',
    keyUrl: 'https://platform.claude.com/settings/keys',
    defaultModel: 'claude-opus-5',
    suggested: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'claude-fable-5-1'],
  },
  openai: {
    label: 'ChatGPT',
    company: 'OpenAI',
    keyPrefix: 'sk-',
    keyUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-5',
    suggested: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
  },
  openrouter: {
    label: 'OpenRouter',
    company: 'Llama, DeepSeek, Mistral, Grok and more',
    keyPrefix: 'sk-or-',
    keyUrl: 'https://openrouter.ai/settings/keys',
    defaultModel: 'deepseek/deepseek-chat',
    suggested: ['deepseek/deepseek-chat', 'meta-llama/llama-3.3-70b-instruct', 'mistralai/mistral-large', 'x-ai/grok-4', 'qwen/qwen3-235b-a22b'],
  },
};

export const isProvider = (v: unknown): v is ProviderId => typeof v === 'string' && v in PROVIDERS;

export type LlmConfig = { provider: ProviderId; apiKey: string; model: string; timeZone: string };
type Options = { json?: boolean; system?: string; history?: ChatTurn[]; long?: boolean };

// ---------- Which key and model to use ----------

export async function listCredentials(userId: string) {
  const [user, rows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { geminiApiKey: true, geminiModel: true, aiProvider: true, timezone: true } }),
    prisma.aiCredential.findMany({ where: { userId } }),
  ]);
  const creds = new Map<ProviderId, { apiKey: string; model: string; models: string[] }>();
  for (const r of rows) {
    if (isProvider(r.provider)) creds.set(r.provider, { apiKey: r.apiKey, model: r.model, models: (r.models as string[] | null) ?? [] });
  }
  // Keys saved before multi-provider support lived on the user row
  if (!creds.has('gemini') && user?.geminiApiKey) {
    creds.set('gemini', { apiKey: user.geminiApiKey, model: user.geminiModel || PROVIDERS.gemini.defaultModel, models: [] });
  }
  if (!creds.has('gemini') && process.env.GEMINI_API_KEY) {
    creds.set('gemini', { apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || PROVIDERS.gemini.defaultModel, models: [] });
  }
  const preferred = isProvider(user?.aiProvider) && creds.has(user.aiProvider) ? user.aiProvider : null;
  const active = preferred ?? ([...creds.keys()][0] ?? null);
  return { creds, active, timeZone: user?.timezone || 'UTC' };
}

export async function getAiConfig(userId: string): Promise<LlmConfig & { backups: LlmConfig[] }> {
  const { creds, active, timeZone } = await listCredentials(userId);
  if (!active) throw new AiError('no_key', 'Add an AI key in Settings (Gemini, Claude, ChatGPT or OpenRouter) to use AI features.');
  const toConfig = (provider: ProviderId): LlmConfig => ({ provider, ...creds.get(provider)!, timeZone });
  return {
    ...toConfig(active),
    // Other saved providers step in when the chosen one is overloaded or out of quota
    backups: [...creds.keys()].filter((p) => p !== active).map(toConfig),
  };
}

// ---------- Generation ----------

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generate(config: LlmConfig & { backups?: LlmConfig[] }, prompt: string, options: Options = {}) {
  const chain = [config, ...(config.backups ?? [])];
  let lastError: unknown;
  for (const [i, c] of chain.entries()) {
    try {
      const result = await generateWith(c, prompt, options);
      if (i > 0) console.warn(`${PROVIDERS[config.provider].label} was unavailable; answered with ${c.provider}`);
      return result;
    } catch (error) {
      lastError = error;
      if (!(error instanceof AiError && error.retryable)) throw error;
    }
  }
  throw lastError;
}

function generateWith(config: LlmConfig, prompt: string, options: Options): Promise<{ text: string; model: string }> {
  switch (config.provider) {
    case 'gemini': return gemini(config, prompt, options);
    case 'anthropic': return claude(config, prompt, options);
    case 'openai': return openAiCompatible('https://api.openai.com/v1', config, prompt, options);
    case 'openrouter': return openAiCompatible('https://openrouter.ai/api/v1', config, prompt, options);
  }
}

export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Some models wrap the JSON in a sentence; take the outermost object
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch { /* fall through */ }
    }
    throw new AiError('api', 'The AI returned something that was not valid JSON. Try again.', true);
  }
}

// ---------- Google Gemini (REST) ----------

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_BACKUPS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

function explainGeminiError(status: number, body: { error?: { message?: string } }) {
  const message = body?.error?.message || `Gemini request failed (${status})`;
  if (status === 400 && /api key not valid/i.test(message)) return 'That Gemini API key is not valid. Copy it again from Google AI Studio.';
  if (status === 403) return `Gemini refused the key: ${message}`;
  if (status === 429) return 'Gemini quota reached on every available model. Wait a minute (or until tomorrow on the free tier) and try again.';
  if (status === 503) return 'Google\'s Gemini servers are overloaded right now (Google\'s side, not your key). Try again in a few minutes.';
  return message;
}

async function gemini(config: LlmConfig, prompt: string, options: Options) {
  const contents = [
    ...(options.history ?? []).map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
    { role: 'user', parts: [{ text: prompt }] },
  ];
  const payload = JSON.stringify({
    contents,
    ...(options.system ? { systemInstruction: { parts: [{ text: options.system }] } } : {}),
    generationConfig: options.json ? { responseMimeType: 'application/json', temperature: 0.4 } : { temperature: 0.8 },
  });

  const models = [config.model, ...GEMINI_BACKUPS.filter((m) => m !== config.model)];
  let lastError: AiError | null = null;
  for (const model of models) {
    // One quick retry on the same model, then the next model
    for (const wait of [0, 1500]) {
      if (wait) await sleep(wait);
      const res = await fetch(`${GEMINI_API}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
        body: payload,
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const text: string = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
        if (text) return { text, model };
        lastError = new AiError('api', 'Gemini returned an empty answer. Try again.', true);
        break;
      }
      lastError = new AiError('api', explainGeminiError(res.status, body), RETRYABLE.has(res.status));
      if (res.status === 404) break; // retired model name: next model
      if (!RETRYABLE.has(res.status)) throw lastError;
    }
  }
  throw lastError ?? new AiError('api', 'Gemini is not responding. Try again in a few minutes.', true);
}

// Newest stable Flash model this key can use, so retired model names never break the app
async function geminiModels(apiKey: string) {
  const res = await fetch(`${GEMINI_API}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey }, cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiError('api', explainGeminiError(res.status, body));
  const version = (id: string) => parseFloat(id.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? '0');
  const ids = ((body.models ?? []) as { name: string; supportedGenerationMethods?: string[] }[])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((id) => /^gemini-[\d.]+-(flash|pro)(-lite)?(-\d{3})?$/.test(id))
    .sort((a, b) => version(b) - version(a) || a.length - b.length);
  const flash = ids.find((id) => /^gemini-[\d.]+-flash(-\d{3})?$/.test(id));
  return { model: flash ?? PROVIDERS.gemini.defaultModel, models: ids };
}

// ---------- Anthropic Claude (official SDK) ----------

function explainClaudeError(error: unknown): AiError {
  if (error instanceof Anthropic.AuthenticationError) return new AiError('api', 'That Claude API key is not valid. Create a new one in the Claude Console.');
  if (error instanceof Anthropic.PermissionDeniedError) return new AiError('api', `Anthropic refused the key: ${error.message}`);
  if (error instanceof Anthropic.NotFoundError) return new AiError('api', 'That Claude model is not available to your key. Pick another model in Settings.');
  if (error instanceof Anthropic.RateLimitError) return new AiError('api', 'Claude rate limit reached. Wait a minute and try again.', true);
  if (error instanceof Anthropic.BadRequestError) {
    return new AiError('api', /credit balance/i.test(error.message)
      ? 'Your Anthropic account is out of credits. Add some in the Claude Console under Billing.'
      : `Claude rejected the request: ${error.message}`);
  }
  if (error instanceof Anthropic.APIError) {
    return new AiError('api', error.status === 529
      ? 'Claude is overloaded right now (Anthropic\'s side, not your key). Try again in a few minutes.'
      : `Claude request failed (${error.status ?? 'network'}): ${error.message}`, true);
  }
  return new AiError('api', 'Could not reach Claude. Try again.', true);
}

async function claude(config: LlmConfig, prompt: string, options: Options) {
  const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 2 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...(options.history ?? []).map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: prompt },
  ];
  const model = config.model;
  const isClaude5 = /^claude-(opus|sonnet|fable)-5/.test(model);
  // Server-side fallbacks re-run a request a safety classifier declined on another model, in the same call
  const fallback =
    model === 'claude-opus-5' ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } :
    model === 'claude-fable-5-1' ? { betas: ['server-side-fallback-2026-06-01'], fallbacks: [{ model: 'claude-opus-4-8' }] } :
    null;

  try {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: options.long ? 16000 : 8000,
      ...(options.system ? { system: options.system } : {}),
      messages,
      // Adaptive thinking on the models that support it; medium effort keeps answers inside the page's time limit
      ...(isClaude5 ? { thinking: { type: 'adaptive' as const }, output_config: { effort: 'medium' as const } } : {}),
      ...(fallback ?? {}),
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === 'refusal') {
      throw new AiError('api', 'Claude declined to answer this one. Try rephrasing, or pick another model in Settings.');
    }
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    if (!text) throw new AiError('api', 'Claude returned an empty answer. Try again.', true);
    return { text, model: response.model || model };
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw explainClaudeError(error);
  }
}

// ---------- OpenAI and OpenRouter (same chat completions shape) ----------

function explainOpenAiError(provider: ProviderId, status: number, body: { error?: { message?: string } }) {
  const name = PROVIDERS[provider].label;
  const message = body?.error?.message || `${name} request failed (${status})`;
  if (status === 401) return new AiError('api', `That ${name} API key is not valid. Create a new one and paste it again.`);
  if (status === 403) return new AiError('api', `${name} refused the request: ${message}`);
  if (status === 402) return new AiError('api', `${name} says the account has no credits left. Add credits, or pick a free model.`);
  if (status === 404) return new AiError('api', `That ${name} model is not available to your key. Pick another model in Settings.`);
  if (status === 429) {
    return new AiError('api', /quota/i.test(message)
      ? `${name} quota used up. Check billing on your ${PROVIDERS[provider].company} account.`
      : `${name} rate limit reached. Wait a minute and try again.`, true);
  }
  return new AiError('api', message, RETRYABLE.has(status));
}

async function openAiCompatible(base: string, config: LlmConfig, prompt: string, options: Options) {
  const messages = [
    ...(options.system ? [{ role: 'system', content: options.system }] : []),
    ...(options.history ?? []),
    { role: 'user', content: prompt },
  ];
  const payload = JSON.stringify({
    model: config.model,
    messages,
    ...(options.json ? { response_format: { type: 'json_object' } } : {}),
    // OpenAI reasoning models only accept the default temperature
    ...(config.provider === 'openrouter' ? { temperature: options.json ? 0.4 : 0.8 } : {}),
  });

  let lastError: AiError | null = null;
  for (const wait of [0, 2000]) {
    if (wait) await sleep(wait);
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...(config.provider === 'openrouter' ? { 'X-Title': 'InstaSage' } : {}),
      },
      body: payload,
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      const text: string = body?.choices?.[0]?.message?.content ?? '';
      if (text) return { text, model: body.model || config.model };
      lastError = new AiError('api', `${PROVIDERS[config.provider].label} returned an empty answer. Try again.`, true);
      continue;
    }
    lastError = explainOpenAiError(config.provider, res.status, body);
    if (!lastError.retryable) throw lastError;
  }
  throw lastError!;
}

async function openAiModels(apiKey: string) {
  const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw explainOpenAiError('openai', res.status, body);
  const version = (id: string) => parseFloat(id.match(/^gpt-(\d+(?:\.\d+)?)/)?.[1] ?? '0');
  const ids = ((body.data ?? []) as { id: string; created: number }[])
    .filter((m) => /^(gpt-\d|o\d)/.test(m.id))
    .filter((m) => !/(audio|realtime|tts|transcribe|image|search|instruct|codex|computer|preview|oss|\d{4}-\d{2}-\d{2})/.test(m.id))
    .sort((a, b) => version(b.id) - version(a.id) || b.created - a.created)
    .map((m) => m.id);
  // Newest flagship ("gpt-5.1" over "gpt-5-mini")
  const model = ids.find((id) => /^gpt-\d+(\.\d+)?$/.test(id)) ?? ids[0] ?? PROVIDERS.openai.defaultModel;
  return { model, models: ids.slice(0, 40) };
}

async function openRouterModels(apiKey: string) {
  const check = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' });
  if (!check.ok) throw explainOpenAiError('openrouter', check.status, await check.json().catch(() => ({})));
  const res = await fetch('https://openrouter.ai/api/v1/models', { cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  const ids = ((body.data ?? []) as { id: string }[]).map((m) => m.id);
  const model = PROVIDERS.openrouter.suggested.find((id) => ids.includes(id)) ?? ids[0] ?? PROVIDERS.openrouter.defaultModel;
  return { model, models: ids.slice(0, 400) };
}

// ---------- Saving a key ----------

// Proves the key works before storing it; returns the model it will use
export async function saveCredential(userId: string, provider: ProviderId, rawKey: string, wantedModel?: string) {
  const apiKey = rawKey.trim();
  if (apiKey.length < 20) {
    throw new AiError('api', `That does not look like a ${PROVIDERS[provider].label} API key. It usually starts with "${PROVIDERS[provider].keyPrefix}".`);
  }

  let found: { model: string; models: string[] };
  if (provider === 'gemini') found = await geminiModels(apiKey);
  else if (provider === 'openai') found = await openAiModels(apiKey);
  else if (provider === 'openrouter') found = await openRouterModels(apiKey);
  else found = { model: PROVIDERS.anthropic.defaultModel, models: PROVIDERS.anthropic.suggested };

  const model = wantedModel?.trim() || found.model;
  await generateWith({ provider, apiKey, model, timeZone: 'UTC' }, 'Reply with the single word OK.', {});

  const data = { apiKey, model, models: found.models };
  await prisma.aiCredential.upsert({
    where: { userId_provider: { userId, provider } },
    update: data,
    create: { ...data, userId, provider },
  });
  // A freshly added key becomes the active one; that is almost always why it was added
  await prisma.user.update({ where: { id: userId }, data: { aiProvider: provider } });
  return model;
}

export async function setModel(userId: string, provider: ProviderId, model: string) {
  const { creds, timeZone } = await listCredentials(userId);
  const cred = creds.get(provider);
  if (!cred) throw new AiError('no_key', `Add a ${PROVIDERS[provider].label} key first.`);
  await generateWith({ provider, apiKey: cred.apiKey, model, timeZone }, 'Reply with the single word OK.', {});
  await prisma.aiCredential.upsert({
    where: { userId_provider: { userId, provider } },
    update: { model },
    create: { userId, provider, apiKey: cred.apiKey, model, models: cred.models },
  });
}
