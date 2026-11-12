import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';
import { getMemory } from '@/services/sageActions';

// Everything Sage changed, newest first, plus what it remembers: for the Status page
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const [actions, memory] = await Promise.all([
    prisma.sageAction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, kind: true, summary: true, active: true, createdAt: true, undoneAt: true } }),
    getMemory(userId),
  ]);
  return NextResponse.json({ actions, memory });
}
