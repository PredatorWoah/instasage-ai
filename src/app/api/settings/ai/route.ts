import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized, aiErrorResponse } from '@/lib/api';
import { saveGeminiKey } from '@/services/ai';

// Never send the key itself back; the last 4 characters are enough to recognise it
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { geminiApiKey: true, geminiModel: true } });
  const key = user?.geminiApiKey;
  return NextResponse.json({
    source: key ? 'saved' : process.env.GEMINI_API_KEY ? 'env' : null,
    last4: key ? key.slice(-4) : null,
    model: user?.geminiModel ?? null,
  });
}

export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { apiKey } = await req.json().catch(() => ({}));
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    return NextResponse.json({ error: 'Paste your Gemini API key first.' }, { status: 400 });
  }
  try {
    const model = await saveGeminiKey(userId, apiKey);
    return NextResponse.json({ source: 'saved', last4: apiKey.trim().slice(-4), model });
  } catch (error) {
    return aiErrorResponse(error);
  }
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  await prisma.user.update({ where: { id: userId }, data: { geminiApiKey: null, geminiModel: null } });
  await prisma.aiResult.deleteMany({ where: { userId } });
  return NextResponse.json({ source: process.env.GEMINI_API_KEY ? 'env' : null, last4: null, model: null });
}
