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
  // A post set to go out automatically never jumps into the past, where it would go out at once
  if (data.scheduledFor && data.scheduledFor.getTime() < Date.now() && (await prisma.scheduledPost.count({ where: { ideaId: id, userId, status: 'scheduled' } }))) {
    return NextResponse.json({ error: 'This one posts automatically, so it needs a future time.' }, { status: 400 });
  }
  const { count } = await prisma.savedIdea.updateMany({ where: { id, userId }, data });
  if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // A post waiting to go out follows its calendar entry: moved with it, or cancelled when it is unscheduled
  if (data.scheduledFor !== undefined) {
    await prisma.scheduledPost.updateMany({
      where: { ideaId: id, userId, status: 'scheduled' },
      data: data.scheduledFor ? { scheduledFor: data.scheduledFor } : { status: 'canceled' },
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  await prisma.scheduledPost.updateMany({ where: { ideaId: id, userId, status: 'scheduled' }, data: { status: 'canceled' } });
  await prisma.savedIdea.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
