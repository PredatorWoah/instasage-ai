import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';

export const STATUSES = ['idea', 'planned', 'posted'];

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await prisma.savedIdea.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } }));
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  if (typeof body.title !== 'string' || !body.title.trim()) return NextResponse.json({ error: 'An idea needs a title.' }, { status: 400 });
  const idea = await prisma.savedIdea.create({
    data: {
      userId,
      title: body.title.trim().slice(0, 200),
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 4000) : '',
      format: typeof body.format === 'string' ? body.format.slice(0, 40) : null,
      source: ['plan', 'brainstorm', 'recommendation'].includes(body.source) ? body.source : 'manual',
    },
  });
  return NextResponse.json(idea);
}
