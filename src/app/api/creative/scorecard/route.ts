import { NextResponse } from 'next/server';
import { failed, requireUserId, unauthorized } from '@/lib/api';
import { ownedAccount } from '@/services/creative';
import { scorecard } from '@/services/forecast';

// How the forecasts made for saved drafts held up once those drafts were posted
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const account = await ownedAccount(userId, new URL(req.url).searchParams.get('account'));
  if (!account) return NextResponse.json({ error: 'Pick one of your accounts.' }, { status: 400 });
  try {
    return NextResponse.json(await scorecard(userId, account.id));
  } catch (error) {
    return failed(error, 'The scorecard');
  }
}
