import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, getTimeZone } from '@/lib/api';
import { comparePeriods, getDashboardData } from '@/services/dashboard';
import { getAccountScope } from '@/lib/scope';
import { MAX_DAYS } from '@/lib/period';

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  // The top bar's time window; ?days= still works for links and older clients
  const scope = await getAccountScope(userId);
  const requested = Math.round(Number(new URL(req.url).searchParams.get('days')));
  const days = requested >= 1 && requested <= MAX_DAYS ? requested : scope.span;
  const [data, compare] = await Promise.all([getDashboardData(scope, days, await getTimeZone(userId)), comparePeriods(scope, days)]);

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
  return NextResponse.json({ days, allTime: scope.days == null && !requested, hasData: data.profiles.length > 0, timeSeries: data.timeSeries, funnel, compare });
}
