import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const profileFields = { name: true, username: true, bio: true, image: true, creatorProfile: true, goal: true, setupDismissed: true } as const;

const PROFILE_KEYS = ['niche', 'audience', 'goals', 'voice', 'avoid', 'language'] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: profileFields });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; username?: string; bio?: string; creatorProfile?: object; goal?: object | typeof Prisma.DbNull; setupDismissed?: boolean } = {};
  for (const key of ['name', 'username', 'bio'] as const) {
    if (typeof body[key] === 'string') data[key] = body[key].trim().slice(0, 500);
  }
  // Creator profile: short text fields plus a posts-per-week number
  if (body.creatorProfile && typeof body.creatorProfile === 'object') {
    const p: Record<string, string | number> = {};
    for (const key of PROFILE_KEYS) {
      const v = body.creatorProfile[key];
      if (typeof v === 'string' && v.trim()) p[key] = v.trim().slice(0, 400);
    }
    const perWeek = Number(body.creatorProfile.postsPerWeek);
    if (Number.isFinite(perWeek) && perWeek > 0 && perWeek <= 50) p.postsPerWeek = Math.round(perWeek);
    data.creatorProfile = p;
  }
  // Goal: { target, deadline? } or null to clear
  if (body.goal === null) data.goal = Prisma.DbNull;
  else if (body.goal && typeof body.goal === 'object') {
    const target = Math.round(Number(body.goal.target));
    if (!Number.isFinite(target) || target <= 0) return NextResponse.json({ error: 'Set a target above zero.' }, { status: 400 });
    const deadline = typeof body.goal.deadline === 'string' && !Number.isNaN(Date.parse(body.goal.deadline)) ? body.goal.deadline : null;
    data.goal = { target, ...(deadline ? { deadline } : {}) };
  }
  if (typeof body.setupDismissed === 'boolean') data.setupDismissed = body.setupDismissed;

  const user = await prisma.user.update({ where: { id: session.user.id }, data, select: profileFields });
  return NextResponse.json(user);
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Accounts, sessions and social profiles (with posts and metrics) cascade
  await prisma.user.delete({ where: { id: session.user.id } });
  return NextResponse.json({ success: true });
}
