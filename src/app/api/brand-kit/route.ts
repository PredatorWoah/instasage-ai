import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { getKit, ownedAccount, saveKit } from '@/services/creative';

// One brand kit per account: GET ?account=<id>, PUT { account, kit }
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const account = await ownedAccount(userId, new URL(req.url).searchParams.get('account'));
  if (!account) return NextResponse.json({ error: 'Pick one of your accounts.' }, { status: 400 });
  return NextResponse.json(await getKit(userId, account.id));
}

export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const account = await ownedAccount(userId, body.account);
  if (!account) return NextResponse.json({ error: 'Pick one of your accounts.' }, { status: 400 });
  return NextResponse.json({ ...(await saveKit(userId, account.id, body.kit)), saved: true });
}
