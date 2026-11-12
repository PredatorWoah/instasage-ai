import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { undoAction } from '@/services/sageActions';

// Reverses one change Sage made: the corrected number goes back, the remembered fact is forgotten...
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await ctx.params;
  const ok = await undoAction(userId, id);
  return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: 'Already undone, or not found.' }, { status: 404 });
}
