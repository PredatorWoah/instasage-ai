import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone, getTimeZone } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { generateReportStory, getCachedReportStory } from '@/services/ai';
import { getMonthlyReport, reportToPrompt } from '@/services/reports';

export const maxDuration = 300;

const monthParam = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v) ? v : null);

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const month = monthParam(new URL(req.url).searchParams.get('month'));
  if (!month) return NextResponse.json({ error: 'month=YYYY-MM is required' }, { status: 400 });
  const scope = await getAccountScope(userId);
  return NextResponse.json(await getCachedReportStory(userId, scope.key, month));
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);
  const { month: raw } = await req.json().catch(() => ({}));
  const month = monthParam(raw);
  if (!month) return NextResponse.json({ error: 'month=YYYY-MM is required' }, { status: 400 });

  const scope = await getAccountScope(userId);
  const report = await getMonthlyReport(scope.profileIds, await getTimeZone(userId), month);
  if (report.kpis.posts === 0 && report.kpis.followersEnd == null) {
    return NextResponse.json({ error: 'Nothing was posted or synced in this month, so there is nothing to review.', code: 'no_data' }, { status: 400 });
  }
  try {
    return NextResponse.json(await generateReportStory(userId, scope.key, month, reportToPrompt(report)));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
