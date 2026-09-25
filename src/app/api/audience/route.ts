import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const profile = await prisma.socialProfile.findFirst({
    where: { userId, platform: 'instagram' },
    select: { username: true, followerCount: true, audience: true, lastSyncedAt: true },
  });
  return NextResponse.json(profile);
}
