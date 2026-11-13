import { NextResponse } from 'next/server';
import { failed, requireUserId, unauthorized } from '@/lib/api';
import { ownedAccount } from '@/services/creative';
import { accountVocab } from '@/services/vocab';

// What works for this account, word by word: proven and weak words, hashtags and caption shape
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const account = await ownedAccount(userId, new URL(req.url).searchParams.get('account'));
  if (!account) return NextResponse.json({ error: 'Pick one of your accounts.' }, { status: 400 });
  try {
    return NextResponse.json(await accountVocab(account.id));
  } catch (error) {
    return failed(error, 'What works for this account');
  }
}
