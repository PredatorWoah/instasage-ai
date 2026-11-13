import { NextResponse } from 'next/server';
import { failed, requireUserId, unauthorized } from '@/lib/api';
import { ownedAccount } from '@/services/creative';
import { hookLibrary } from '@/services/hooks';

// Every opening line the account has posted with how it did, and which hook styles work
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const account = await ownedAccount(userId, new URL(req.url).searchParams.get('account'));
  if (!account) return NextResponse.json({ error: 'Pick one of your accounts.' }, { status: 400 });
  try {
    return NextResponse.json(await hookLibrary(account.id));
  } catch (error) {
    return failed(error, 'Your hook library');
  }
}
