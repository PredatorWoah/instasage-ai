import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';
import { PROVIDERS, listCredentials } from '@/services/llm';

const WEEK = 7 * 86_400_000;

// Health of every connection, used by the warning banner, the setup checklist and the Status page
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const [user, profiles, posts, meta, { creds, active }] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, creatorProfile: true, goal: true, setupDismissed: true, youtubeApiKey: true } }),
    prisma.socialProfile.findMany({ where: { userId }, orderBy: { lastSyncedAt: 'desc' } }),
    prisma.post.count({ where: { socialProfile: { userId } } }),
    prisma.metaLink.findUnique({ where: { userId }, select: { igUsername: true, expiresAt: true } }),
    listCredentials(userId),
  ]);
  const jobs = await prisma.syncJob.findMany({
    where: { socialProfileId: { in: profiles.map((p) => p.id) } },
    orderBy: { startedAt: 'desc' },
    take: 60,
  });
  const now = Date.now();

  const accounts = profiles.map((p) => {
    const last = jobs.find((j) => j.socialProfileId === p.id);
    const expiresAt = p.platform === 'instagram' ? p.tokenExpiresAt : null;
    const problems: string[] = [];
    if (!p.isConnected) problems.push('disconnected');
    if (expiresAt && expiresAt.getTime() < now) problems.push('token_expired');
    else if (expiresAt && expiresAt.getTime() - now < WEEK) problems.push('token_expiring');
    if (last?.status === 'failed') problems.push('sync_failed');
    return {
      id: p.id,
      platform: p.platform,
      username: p.username,
      isConnected: p.isConnected,
      tokenExpiresAt: expiresAt,
      lastSyncedAt: p.lastSyncedAt,
      lastJob: last ? { status: last.status, error: last.errorMessage, at: last.completedAt ?? last.startedAt } : null,
      problems,
    };
  });

  const profile = (user?.creatorProfile ?? {}) as Record<string, unknown>;
  const activeCred = active ? creds.get(active) : null;
  return NextResponse.json({
    accounts,
    ai: active ? { provider: active, label: PROVIDERS[active].label, model: activeCred?.model ?? null, saved: [...creds.keys()] } : null,
    timezone: user?.timezone ?? null,
    youtubeKey: !!(user?.youtubeApiKey || process.env.YOUTUBE_API_KEY),
    facebook: meta,
    setup: {
      dismissed: user?.setupDismissed ?? false,
      steps: {
        account: profiles.length > 0,
        synced: posts > 0,
        ai: !!active,
        timezone: !!user?.timezone,
        profile: Object.keys(profile).length > 0,
        goal: !!user?.goal,
      },
    },
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
