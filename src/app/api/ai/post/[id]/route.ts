import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { analyzePost, getCachedPostAnalysis } from '@/services/ai';

// Leaves room for retries and falling back to another provider when the chosen AI is busy
export const maxDuration = 300;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await ctx.params;
  return NextResponse.json(await getCachedPostAnalysis(userId, id));
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await analyzePost(userId, id));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
