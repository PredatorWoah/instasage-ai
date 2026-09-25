import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse } from '@/lib/api';
import { getCachedResult, generateInsights } from '@/services/ai';

// Returns the cached result; null means nothing has been generated yet
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await getCachedResult(userId, 'insights'));
}

// Generates a fresh result with Gemini and caches it
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  try {
    return NextResponse.json(await generateInsights(userId));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
