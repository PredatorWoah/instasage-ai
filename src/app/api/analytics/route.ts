import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, getTimeZone } from '@/lib/api';
import { getDashboardData } from '@/services/dashboard';
import { getAccountScope } from '@/lib/scope';

const ALLOWED_DAYS = [7, 30, 90, 365];

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const requested = Number(new URL(req.url).searchParams.get('days'));
  const days = ALLOWED_DAYS.includes(requested) ? requested : 30;
  const scope = await getAccountScope(userId);
  const data = await getDashboardData(scope, days, await getTimeZone(userId));

  // 30-day funnel across the Instagram accounts in view: reach, profile visits, link taps, follows
  type Funnel = { profileViews: number | null; linkTaps: number | null; follows: number | null; unfollows: number | null; accountsEngaged: number | null };
  const ig = scope.profiles.filter((p) => p.platform === 'instagram' && (p.funnel || p.reach30 != null));
  const sum = (pick: (f: Funnel) => number | null) => {
    const vals = ig.map((p) => (p.funnel ? pick(p.funnel as Funnel) : null)).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const funnel = ig.length ? {
    reach: ig.every((p) => p.reach30 != null) ? ig.reduce((a, p) => a + (p.reach30 ?? 0), 0) : null,
    accountsEngaged: sum((f) => f.accountsEngaged),
    profileViews: sum((f) => f.profileViews),
    linkTaps: sum((f) => f.linkTaps),
    follows: sum((f) => f.follows),
    unfollows: sum((f) => f.unfollows),
  } : null;
  return NextResponse.json({ days, hasData: data.profiles.length > 0, timeSeries: data.timeSeries, funnel });
}
