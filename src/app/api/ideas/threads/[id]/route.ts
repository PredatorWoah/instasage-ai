import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const thread = await prisma.ideaThread.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, content: true, model: true, createdAt: true } } },
  });
  if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(thread);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const { title } = await req.json().catch(() => ({}));
  if (typeof title !== 'string' || !title.trim()) return NextResponse.json({ error: 'Give it a name' }, { status: 400 });
  const { count } = await prisma.ideaThread.updateMany({ where: { id, userId }, data: { title: title.trim().slice(0, 80) } });
  return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  await prisma.ideaThread.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
