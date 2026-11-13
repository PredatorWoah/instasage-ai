import { NextResponse } from 'next/server';
import { failed, requireUserId, unauthorized } from '@/lib/api';
import { ownedAccount } from '@/services/creative';
import { forecastDraft } from '@/services/forecast';

// { account, format, body, hashtags } → { forecast } (null while the account has too few posts to tell)
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const account = await ownedAccount(userId, body.account);
  if (!account) return NextResponse.json({ error: 'Pick one of your accounts.' }, { status: 400 });
  try {
    const forecast = await forecastDraft(account.id, {
      format: typeof body.format === 'string' ? body.format : 'caption',
      body: typeof body.body === 'string' ? body.body.slice(0, 5000) : '',
      hashtags: typeof body.hashtags === 'string' ? body.hashtags.slice(0, 1000) : '',
    });
    return NextResponse.json({ forecast });
  } catch (error) {
    return failed(error, 'The forecast');
  }
}
