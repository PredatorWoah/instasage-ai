import { NextResponse } from 'next/server';
import { failed, requireUserId, unauthorized } from '@/lib/api';
import { createDraft, draftResults, listDrafts, ownedAccount } from '@/services/creative';

// Saved captions and briefs for one account, newest first, with how any linked post did
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const account = await ownedAccount(userId, new URL(req.url).searchParams.get('account'));
  if (!account) return NextResponse.json({ error: 'Pick one of your accounts.' }, { status: 400 });
  let drafts: Awaited<ReturnType<typeof listDrafts>>;
  let results: Awaited<ReturnType<typeof draftResults>>;
  try {
    [drafts, results] = await Promise.all([listDrafts(userId, account.id), draftResults(userId, account.id)]);
  } catch (error) {
    return failed(error, 'Your saved drafts');
  }
  return NextResponse.json({ drafts: drafts.map((d) => ({ id: d.id, kind: d.kind, title: d.title, data: d.data, postId: d.postId, updatedAt: d.updatedAt, result: results[d.id] ?? null })) });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const account = await ownedAccount(userId, body.account);
  if (!account) return NextResponse.json({ error: 'Pick one of your accounts.' }, { status: 400 });
  const draft = await createDraft(userId, account.id, body).catch((error) => {
    console.error('Saving a draft failed:', error);
    return undefined;
  });
  if (draft === undefined) return NextResponse.json({ error: 'Could not save. The server hit an error.' }, { status: 500 });
  return draft ? NextResponse.json({ id: draft.id }) : NextResponse.json({ error: 'Unknown draft type.' }, { status: 400 });
}
