import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';
import { metaCallbackUrl, metaOAuthConfig, ownBenchmark, refreshCompetitor } from '@/services/competitors';

export const maxDuration = 60;

// Connection status, your own benchmark and every tracked competitor
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const [link, competitors, you] = await Promise.all([
    prisma.metaLink.findUnique({ where: { userId }, select: { igUsername: true, pageName: true, expiresAt: true } }),
    prisma.competitor.findMany({ where: { userId }, orderBy: { followers: 'desc' } }),
    ownBenchmark(userId),
  ]);
  const config = metaOAuthConfig();
  return NextResponse.json({
    configured: !!config,
    usesConfigId: !!config?.configId,
    redirectUri: metaCallbackUrl(req),
    link,
    you,
    competitors,
  });
}

// { username } adds one; { refresh: true } refreshes every competitor
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));

  if (body.refresh) {
    const rows = await prisma.competitor.findMany({ where: { userId }, select: { username: true } });
    const failed: string[] = [];
    for (const r of rows) await refreshCompetitor(userId, r.username).catch((e) => failed.push(`@${r.username}: ${(e as Error).message}`));
    return NextResponse.json({ refreshed: rows.length - failed.length, failed });
  }

  if (typeof body.username !== 'string' || !body.username.trim()) return NextResponse.json({ error: 'Type an Instagram username.' }, { status: 400 });
  if ((await prisma.competitor.count({ where: { userId } })) >= 20) return NextResponse.json({ error: 'You can track up to 20 accounts.' }, { status: 400 });
  try {
    return NextResponse.json(await refreshCompetitor(userId, body.username));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

// ?id= removes one competitor; ?link=1 disconnects Facebook
export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const params = new URL(req.url).searchParams;
  if (params.get('link')) await prisma.metaLink.deleteMany({ where: { userId } });
  const id = params.get('id');
  if (id) await prisma.competitor.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
