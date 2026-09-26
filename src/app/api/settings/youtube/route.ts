import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';
import { saveYouTubeKey } from '@/services/youtube';

async function status(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { youtubeApiKey: true } });
  const key = user?.youtubeApiKey;
  return { source: key ? 'saved' : process.env.YOUTUBE_API_KEY ? 'env' : null, last4: key ? key.slice(-4) : null };
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await status(userId));
}

export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { apiKey } = await req.json().catch(() => ({}));
  if (typeof apiKey !== 'string' || !apiKey.trim()) return NextResponse.json({ error: 'Paste your YouTube API key first.' }, { status: 400 });
  try {
    await saveYouTubeKey(userId, apiKey);
    return NextResponse.json(await status(userId));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await prisma.user.update({ where: { id: userId }, data: { youtubeApiKey: null } });
  return NextResponse.json(await status(userId));
}
