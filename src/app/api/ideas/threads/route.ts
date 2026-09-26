import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const threads = await prisma.ideaThread.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } },
    take: 50,
  });
  return NextResponse.json(threads.map(({ _count, ...t }) => ({ ...t, messages: _count.messages })));
}
