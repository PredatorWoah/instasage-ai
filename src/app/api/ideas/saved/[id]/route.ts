import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { title?: string; notes?: string; status?: string } = {};
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200);
  if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 4000);
  if (['idea', 'planned', 'posted'].includes(body.status)) data.status = body.status;
  const { count } = await prisma.savedIdea.updateMany({ where: { id, userId }, data });
  return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  await prisma.savedIdea.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
