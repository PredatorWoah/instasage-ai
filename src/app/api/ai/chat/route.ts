import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { chatWithAssistant, type ChatTurn } from '@/services/ai';

// Leaves room for retries and model fallback when Gemini is busy
export const maxDuration = 60;

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);

  const { message, history } = await req.json().catch(() => ({}));
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Type a message first.' }, { status: 400 });
  }
  const turns: ChatTurn[] = Array.isArray(history)
    ? history
        .filter((t) => (t?.role === 'user' || t?.role === 'assistant') && typeof t?.content === 'string')
        .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }))
    : [];

  try {
    const reply = await chatWithAssistant(userId, await getAccountScope(userId), turns, message.slice(0, 4000));
    return NextResponse.json({ reply });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
