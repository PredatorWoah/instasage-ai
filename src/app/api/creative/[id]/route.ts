import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { deleteDraft, updateDraft } from '@/services/creative';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const draft = await updateDraft(userId, id, body);
  return draft ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found.' }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { id } = await ctx.params;
  return (await deleteDraft(userId, id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found.' }, { status: 404 });
}
