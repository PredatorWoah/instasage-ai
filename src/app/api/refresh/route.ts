import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';
import { refreshProfileLight, syncSocialProfile } from '@/services/sync';

// A full sync can take a minute per account
export const maxDuration = 300;

const FULL_AFTER_MS = 6 * 60 * 60 * 1000; // posts, insights and thumbnails older than this get re-pulled
const LIGHT_EVERY_MS = 5 * 60 * 1000;
const lastLight = new Map<string, number>();

// Called when the app opens, so numbers are fresh without anyone pressing Sync:
// a quick follower refresh every time, and a full sync when the last one is old.
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const profiles = await prisma.socialProfile.findMany({ where: { userId, isConnected: true } });
  const now = Date.now();
  let changed = false;
  let synced = 0;

  for (const p of profiles) {
    const lastJob = await prisma.syncJob.findFirst({ where: { socialProfileId: p.id }, orderBy: { startedAt: 'desc' } });
    const jobAge = lastJob ? now - lastJob.startedAt.getTime() : Infinity;
    // Someone else is syncing it, or it failed a moment ago: leave it alone for now
    if (lastJob?.status === 'running' && jobAge < 10 * 60 * 1000) continue;
    const recentlyFailed = lastJob?.status === 'failed' && jobAge < 30 * 60 * 1000;

    const needsReach = p.platform === 'instagram' && p.reach30 == null;
    const stale = now - p.lastSyncedAt.getTime() > FULL_AFTER_MS || needsReach;

    try {
      if (stale && !recentlyFailed) {
        await syncSocialProfile(p.id);
        synced += 1;
        changed = true;
      } else if (now - (lastLight.get(p.id) ?? 0) > LIGHT_EVERY_MS) {
        lastLight.set(p.id, now);
        if (await refreshProfileLight(p.id)) changed = true;
      }
    } catch (error) {
      console.warn(`Refresh of @${p.username} failed:`, (error as Error).message);
    }
  }
  return NextResponse.json({ changed, synced });
}
