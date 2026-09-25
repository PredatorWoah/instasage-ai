import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { getDashboardData } from '@/services/dashboard';

const ALLOWED_DAYS = [7, 30, 90, 365];

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const requested = Number(new URL(req.url).searchParams.get('days'));
  const days = ALLOWED_DAYS.includes(requested) ? requested : 30;
  const data = await getDashboardData(userId, days);
  return NextResponse.json({ days, hasData: data.profiles.length > 0, timeSeries: data.timeSeries });
}
