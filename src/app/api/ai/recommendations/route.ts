import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { getCachedResult, generateRecommendations } from '@/services/ai';

// Leaves room for retries and falling back to another provider when the chosen AI is busy
export const maxDuration = 300;

// Returns the cached result; null means nothing has been generated yet
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const scope = await getAccountScope(userId);
  return NextResponse.json(await getCachedResult(userId, 'recommendations', scope.key));
}

// Generates a fresh result with the chosen AI and caches it
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);
  try {
    return NextResponse.json(await generateRecommendations(userId, await getAccountScope(userId)));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
