import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { IgPermissionError, PERMISSION_CODE, setCommentHidden } from '@/services/comments';

// { postId, commentId, hide } hides or shows a comment (only you and its author see a hidden one)
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  if (typeof body.postId !== 'string' || typeof body.commentId !== 'string' || typeof body.hide !== 'boolean') return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  try {
    const result = await setCommentHidden(userId, body.postId, body.commentId, body.hide);
    if (!result) return NextResponse.json({ error: 'That comment was not found on this post.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof IgPermissionError) return NextResponse.json({ error: 'InstaSage is not allowed to manage comments yet.', code: PERMISSION_CODE }, { status: 403 });
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
