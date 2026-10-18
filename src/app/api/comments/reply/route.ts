import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { IgPermissionError, PERMISSION_CODE, replyToComment } from '@/services/comments';

// { postId, commentId, message } posts a public reply on Instagram
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (typeof body.postId !== 'string' || typeof body.commentId !== 'string' || !message) return NextResponse.json({ error: 'Write a reply first.' }, { status: 400 });
  if (message.length > 2200) return NextResponse.json({ error: 'Instagram replies are limited to 2,200 characters.' }, { status: 400 });
  try {
    const result = await replyToComment(userId, body.postId, body.commentId, message);
    if (!result) return NextResponse.json({ error: 'That comment was not found on this post. It may have been deleted.' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof IgPermissionError) return NextResponse.json({ error: 'InstaSage is not allowed to reply yet.', code: PERMISSION_CODE }, { status: 403 });
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
