import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { generateGamePlan, getCachedPlan } from '@/services/ai';

// A full 30-day plan is a long answer; slower models (and fallbacks) need the room
export const maxDuration = 300;

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const scope = await getAccountScope(userId);
  return NextResponse.json(await getCachedPlan(userId, scope.key));
}

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);
  try {
    return NextResponse.json(await generateGamePlan(userId, await getAccountScope(userId)));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
