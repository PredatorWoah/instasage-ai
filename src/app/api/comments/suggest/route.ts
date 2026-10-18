import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse } from '@/lib/api';
import { suggestCommentReplies } from '@/services/ai';

export const maxDuration = 300;

// { postId, comments: [{ id, username, text }] } → { suggestions: { [commentId]: string[] } }
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const comments = Array.isArray(body.comments)
    ? body.comments
      .filter((c: unknown): c is { id: string; username: string; text: string } => !!c && typeof (c as { id?: unknown }).id === 'string' && typeof (c as { text?: unknown }).text === 'string')
      .map((c: { id: string; username?: string; text: string }) => ({ id: c.id.slice(0, 40), username: String(c.username ?? '').slice(0, 40), text: c.text.slice(0, 500) }))
      .slice(0, 15)
    : [];
  if (typeof body.postId !== 'string' || !comments.length) return NextResponse.json({ error: 'Pick some comments first.' }, { status: 400 });
  try {
    return NextResponse.json({ suggestions: await suggestCommentReplies(userId, body.postId, comments) });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
