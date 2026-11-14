import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { advance, postView, readMedia, removeStored } from '@/services/publish';

export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

const own = (userId: string, id: string) => prisma.scheduledPost.findFirst({ where: { id, userId } });

// Where a post is now. Polling this also moves a post that is due or processing one step on.
export async function GET(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const post = await own(userId, (await params).id);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ post: postView(await advance(post)) });
}

// { scheduledFor: ISO } moves a waiting post; { retry: true } sends a failed one again; { now: true } sends a waiting one at once
export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const post = await own(userId, (await params).id);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  if (body.retry === true) {
    if (post.status !== 'failed') return NextResponse.json({ error: 'Only a failed post can be retried.' }, { status: 400 });
    const fresh = await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: 'scheduled', scheduledFor: null, attempts: 0, error: null, containerId: null, children: Prisma.DbNull, startedAt: null, lockedAt: null } });
    return NextResponse.json({ post: postView(await advance(fresh)) });
  }
  if (post.status !== 'scheduled') return NextResponse.json({ error: 'This post is already on its way, so it can no longer change.' }, { status: 400 });
  if (body.now === true) {
    const fresh = await prisma.scheduledPost.update({ where: { id: post.id }, data: { scheduledFor: null } });
    return NextResponse.json({ post: postView(await advance(fresh)) });
  }
  if (typeof body.scheduledFor === 'string' && !Number.isNaN(Date.parse(body.scheduledFor))) {
    const when = new Date(body.scheduledFor);
    if (when.getTime() < Date.now() - 60_000) return NextResponse.json({ error: 'That time has passed.' }, { status: 400 });
    const fresh = await prisma.scheduledPost.update({ where: { id: post.id }, data: { scheduledFor: when } });
    if (post.ideaId) await prisma.savedIdea.updateMany({ where: { id: post.ideaId, userId }, data: { scheduledFor: when } });
    return NextResponse.json({ post: postView(fresh) });
  }
  return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
}

// Cancels a waiting post, or clears a failed one. A post Instagram is already preparing can't be stopped half way.
export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const post = await own(userId, (await params).id);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (post.status !== 'scheduled' && post.status !== 'failed') {
    return NextResponse.json({ error: post.status === 'processing' ? 'Instagram is preparing this post right now, so it can no longer be stopped.' : 'This post is already live. Delete it on Instagram if it needs to go.' }, { status: 400 });
  }
  await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: 'canceled' } });
  if (post.ideaId && post.status === 'scheduled') await prisma.savedIdea.updateMany({ where: { id: post.ideaId, userId }, data: { status: 'planned' } });
  await removeStored(readMedia(post.media));
  return NextResponse.json({ ok: true });
}
