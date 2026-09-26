import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { generateCompetitorTakeaways, getCachedTakeaways } from '@/services/ai';

export const maxDuration = 300;

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  return NextResponse.json(await getCachedTakeaways(userId));
}

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);
  try {
    return NextResponse.json(await generateCompetitorTakeaways(userId, await getAccountScope(userId)));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
