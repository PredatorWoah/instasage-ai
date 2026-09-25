import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse } from '@/lib/api';
import { getCachedResult, generateRecommendations } from '@/services/ai';

// Leaves room for retries and model fallback when Gemini is busy
export const maxDuration = 60;

// Returns the cached result; null means nothing has been generated yet
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await getCachedResult(userId, 'recommendations'));
}

// Generates a fresh result with Gemini and caches it
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  try {
    return NextResponse.json(await generateRecommendations(userId));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
