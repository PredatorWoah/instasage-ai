import { after, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';
import { refreshProfileLight, syncSocialProfile } from '@/services/sync';
import { runQueue } from '@/services/publish';

// A full sync can take a minute per account
export const maxDuration = 300;

const FULL_AFTER_MS = 6 * 60 * 60 * 1000; // posts, insights and thumbnails older than this get re-pulled
const LIGHT_EVERY_MS = 5 * 60 * 1000;
const lastLight = new Map<string, number>();

// Called when the app opens, so numbers are fresh without anyone pressing Sync: a quick follower
// refresh every time, and a full sync when the last one is old. The full sync and any posting run after
// the answer is sent: they used to hold this request (and the database) for a minute, which slowed down
// every other page loading at the same time.
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  // Disconnected accounts are included too: one marked disconnected by mistake would otherwise never
  // sync again. They get a full try at most hourly, and a token that is really dead just fails again.
  const [profiles, due] = await Promise.all([
    prisma.socialProfile.findMany({ where: { userId } }),
    prisma.scheduledPost.count({ where: { userId, OR: [{ status: 'processing' }, { status: 'scheduled', scheduledFor: { lte: new Date() } }] } }).catch(() => 0),
  ]);
  // The latest sync of each account, in one query instead of one per account
  const jobs = profiles.length ? await prisma.syncJob.findMany({ where: { socialProfileId: { in: profiles.map((p) => p.id) } }, orderBy: { startedAt: 'desc' }, distinct: ['socialProfileId'] }) : [];
  const now = Date.now();
  const full: typeof profiles = [];
  const light: typeof profiles = [];

  for (const p of profiles) {
    const lastJob = jobs.find((j) => j.socialProfileId === p.id);
    const jobAge = lastJob ? now - lastJob.startedAt.getTime() : Infinity;
    // Someone else is syncing it, or it failed a moment ago: leave it alone for now
    if (lastJob?.status === 'running' && jobAge < 10 * 60 * 1000) continue;
    const recentlyFailed = lastJob?.status === 'failed' && jobAge < 30 * 60 * 1000;
    if (!p.isConnected) {
      if (jobAge >= 60 * 60 * 1000 && !(p.platform === 'instagram' && !p.accessToken)) full.push(p);
      continue;
    }
    const needsReach = p.platform === 'instagram' && p.reach30 == null;
    const stale = now - p.lastSyncedAt.getTime() > FULL_AFTER_MS || needsReach;
    if (stale && !recentlyFailed) full.push(p);
    else if (now - (lastLight.get(p.id) ?? 0) > LIGHT_EVERY_MS) {
      lastLight.set(p.id, now);
      light.push(p);
    }
  }

  // The quick follower refresh answers now, all accounts at once
  const changed = (await Promise.all(light.map((p) => refreshProfileLight(p.id).catch((error) => {
    console.warn(`Refresh of @${p.username} failed:`, (error as Error).message);
    return false;
  })))).some(Boolean);

  if (full.length || due) {
    after(async () => {
      for (const p of full) {
        await syncSocialProfile(p.id).catch((error) => console.warn(`Background sync of @${p.username} failed:`, (error as Error).message));
      }
      // Opening the app also sends anything that is due, as a backstop for the scheduler
      if (due) await runQueue('app', 20_000, userId).catch((error) => console.warn('Posting from refresh failed:', (error as Error).message));
    });
  }
  // syncing: the page checks back once, after the background sync has had time to finish
  return NextResponse.json({ changed, syncing: full.length + (due ? 1 : 0) });
}
