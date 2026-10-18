import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { syncSocialProfile } from '@/services/sync';
import { generateInsights } from '@/services/ai';
import { refreshCompetitor } from '@/services/competitors';
import { sendDailyNotifications } from '@/services/push';

// Runs daily from vercel.json (01:00 UTC, about 6:30 AM in India)
export const maxDuration = 60;

// Stop starting new work after this, so the function finishes inside its time limit
const TIME_BUDGET_MS = 45_000;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const started = Date.now();
  // Least recently synced first, so anything skipped today goes first tomorrow
  const profiles = await prisma.socialProfile.findMany({ orderBy: { lastSyncedAt: 'asc' } });
  const results: { account: string; ok: boolean; error?: string }[] = [];

  for (const profile of profiles) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    try {
      await syncSocialProfile(profile.id);
      results.push({ account: `${profile.platform}:@${profile.username}`, ok: true });
    } catch (error) {
      results.push({ account: `${profile.platform}:@${profile.username}`, ok: false, error: (error as Error).message });
    }
  }

  // Competitors' public numbers, oldest first, while there is time left
  const rivals = await prisma.competitor.findMany({ orderBy: { lastSyncedAt: 'asc' }, select: { userId: true, username: true } });
  let rivalsRefreshed = 0;
  for (const r of rivals) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    await refreshCompetitor(r.userId, r.username).then(() => rivalsRefreshed++).catch(() => {});
  }

  // Push the morning digest and any new alerts to devices that turned notifications on
  const userIds = [...new Set(profiles.map((p) => p.userId))];
  const notified: string[] = [];
  for (const userId of userIds) {
    notified.push(await sendDailyNotifications(userId).catch((e) => `failed: ${(e as Error).message}`));
  }

  // Fresh insights waiting in the morning (skipped quietly without an AI key)
  let insights = 'skipped';
  if (Date.now() - started < TIME_BUDGET_MS && results.some((r) => r.ok)) {
    try {
      for (const userId of userIds) {
        const ids = profiles.filter((p) => p.userId === userId).map((p) => p.id);
        await generateInsights(userId, { key: 'all', profileIds: ids });
      }
      insights = 'refreshed';
    } catch (error) {
      insights = `not refreshed: ${(error as Error).message}`;
    }
  }

  const summary = { synced: results.filter((r) => r.ok).length, total: profiles.length, competitors: `${rivalsRefreshed}/${rivals.length}`, insights, notified, results };
  console.log('Daily sync:', JSON.stringify(summary));
  return NextResponse.json(summary);
}
