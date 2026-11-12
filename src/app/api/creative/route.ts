import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { createDraft, draftResults, listDrafts, ownedAccount } from '@/services/creative';

// Saved captions and briefs for one account, newest first, with how any linked post did
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const account = await ownedAccount(userId, new URL(req.url).searchParams.get('account'));
  if (!account) return NextResponse.json({ error: 'Pick one of your accounts.' }, { status: 400 });
  const [drafts, results] = await Promise.all([listDrafts(userId, account.id), draftResults(userId, account.id)]);
  return NextResponse.json({ drafts: drafts.map((d) => ({ id: d.id, kind: d.kind, title: d.title, data: d.data, postId: d.postId, updatedAt: d.updatedAt, result: results[d.id] ?? null })) });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const account = await ownedAccount(userId, body.account);
  if (!account) return NextResponse.json({ error: 'Pick one of your accounts.' }, { status: 400 });
  const draft = await createDraft(userId, account.id, body);
  return draft ? NextResponse.json({ id: draft.id }) : NextResponse.json({ error: 'Unknown draft type.' }, { status: 400 });
}
