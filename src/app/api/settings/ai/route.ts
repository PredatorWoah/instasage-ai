import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized, aiErrorResponse } from '@/lib/api';
import { PROVIDERS, isProvider, listCredentials, saveCredential, setModel, type ProviderId } from '@/services/llm';

// Every provider with its status. Keys never leave the server; the last 4 characters identify them.
async function status(userId: string) {
  const [{ creds, active }, saved] = await Promise.all([
    listCredentials(userId),
    prisma.aiCredential.findMany({ where: { userId }, select: { provider: true } }),
  ]);
  const savedSet = new Set(saved.map((s) => s.provider));
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { geminiApiKey: true } });
  return {
    active,
    providers: (Object.keys(PROVIDERS) as ProviderId[]).map((id) => {
      const cred = creds.get(id);
      const fromEnv = id === 'gemini' && cred && !savedSet.has(id) && !user?.geminiApiKey;
      return {
        id,
        ...PROVIDERS[id],
        connected: !!cred,
        source: cred ? (fromEnv ? 'env' : 'saved') : null,
        last4: cred && !fromEnv ? cred.apiKey.slice(-4) : null,
        model: cred?.model ?? null,
        models: cred?.models.length ? cred.models : PROVIDERS[id].suggested,
      };
    }),
  };
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await status(userId));
}

// Save (and test) a key: { provider, apiKey, model? }
export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { provider, apiKey, model } = await req.json().catch(() => ({}));
  if (!isProvider(provider)) return NextResponse.json({ error: 'Unknown AI provider.' }, { status: 400 });
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    return NextResponse.json({ error: `Paste your ${PROVIDERS[provider].label} API key first.` }, { status: 400 });
  }
  try {
    const used = await saveCredential(userId, provider, apiKey, typeof model === 'string' ? model : undefined);
    return NextResponse.json({ ...(await status(userId)), saved: { provider, model: used } });
  } catch (error) {
    return aiErrorResponse(error);
  }
}

// Switch the active provider and/or its model: { provider, model?, activate? }
export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { provider, model, activate } = await req.json().catch(() => ({}));
  if (!isProvider(provider)) return NextResponse.json({ error: 'Unknown AI provider.' }, { status: 400 });
  try {
    if (typeof model === 'string' && model.trim()) await setModel(userId, provider, model.trim());
    if (activate) {
      const { creds } = await listCredentials(userId);
      if (!creds.has(provider)) return NextResponse.json({ error: `Add a ${PROVIDERS[provider].label} key first.` }, { status: 400 });
      await prisma.user.update({ where: { id: userId }, data: { aiProvider: provider } });
    }
    return NextResponse.json(await status(userId));
  } catch (error) {
    return aiErrorResponse(error);
  }
}

// Remove a key: ?provider=anthropic
export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const provider = new URL(req.url).searchParams.get('provider');
  if (!isProvider(provider)) return NextResponse.json({ error: 'Unknown AI provider.' }, { status: 400 });

  await prisma.aiCredential.deleteMany({ where: { userId, provider } });
  if (provider === 'gemini') await prisma.user.update({ where: { id: userId }, data: { geminiApiKey: null, geminiModel: null } });
  await prisma.user.updateMany({ where: { id: userId, aiProvider: provider }, data: { aiProvider: null } });
  return NextResponse.json(await status(userId));
}
