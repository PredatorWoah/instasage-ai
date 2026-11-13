import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { generateQuestionIdeas } from '@/services/ai';
import { cachedQuestions } from '@/services/questions';

export const maxDuration = 300;

// Sage turns the questions already read from the comments into post ideas
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const scope = await getAccountScope(userId);
  const mined = await cachedQuestions(userId, scope.key);
  if (!mined) return NextResponse.json({ error: 'Read the comments first.', code: 'no_data' }, { status: 400 });
  try {
    return NextResponse.json(await generateQuestionIdeas(userId, scope, mined));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
