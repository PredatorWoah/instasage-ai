import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, getTimeZone } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { buildAnalysis } from '@/services/analysis';

// The raw patterns the AI reads (no AI involved), for the "numbers behind it" section of Insights
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const scope = await getAccountScope(userId);
  if (!scope.profileIds.length) return NextResponse.json(null);
  const a = await buildAnalysis(scope.profileIds, await getTimeZone(userId));
  return NextResponse.json({
    totals: a.totals,
    momentum: a.momentum,
    cadence: a.cadence,
    dimensions: [
      { key: 'format', title: 'Format', groups: a.byFormat },
      { key: 'weekday', title: 'Day posted', groups: a.byWeekday },
      { key: 'slot', title: 'Time of day', groups: a.bySlot },
      { key: 'caption', title: 'Caption length', groups: a.byCaption },
      { key: 'hook', title: 'First line', groups: a.byHook },
      { key: 'cta', title: 'Call to action', groups: a.byCta },
      { key: 'hashtags', title: 'Hashtags', groups: a.byHashtags },
      { key: 'tags', title: 'Your best hashtags', groups: a.hashtags },
    ].filter((d) => d.groups.length >= 2),
  });
}
