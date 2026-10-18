import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

// { title?, notes?, status?, postId? (null unlinks), scheduledFor? (null clears) }
export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { title?: string; notes?: string; status?: string; postId?: string | null; scheduledFor?: Date | null } = {};
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim().slice(0, 200);
  if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 4000);
  if (['idea', 'planned', 'posted'].includes(body.status)) data.status = body.status;
  if (body.postId === null) data.postId = null;
  if (typeof body.postId === 'string') {
    // Only one of your own posts can be linked
    const post = await prisma.post.findFirst({ where: { id: body.postId, socialProfile: { userId } }, select: { id: true } });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    data.postId = post.id;
    data.status = 'posted';
  }
  if (body.scheduledFor === null) data.scheduledFor = null;
  if (typeof body.scheduledFor === 'string' && !Number.isNaN(Date.parse(body.scheduledFor))) {
    data.scheduledFor = new Date(body.scheduledFor);
    if (!data.status) data.status = 'planned';
  }
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
