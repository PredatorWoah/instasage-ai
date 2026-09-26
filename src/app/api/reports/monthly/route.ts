import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, rememberTimeZone, getTimeZone } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { getMonthlyReport } from '@/services/reports';

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);
  const scope = await getAccountScope(userId);
  const month = new URL(req.url).searchParams.get('month');
  return NextResponse.json(await getMonthlyReport(scope.profileIds, await getTimeZone(userId), month));
}
