import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { generateBriefing, getCachedBriefing } from '@/services/ai';

// Leaves room for retries and falling back to another provider when the chosen AI is busy
export const maxDuration = 300;

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await getCachedBriefing(userId, await getAccountScope(userId)));
}

// Writes a fresh briefing for the account and time window in view
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);
  try {
    return NextResponse.json(await generateBriefing(userId, await getAccountScope(userId)));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
