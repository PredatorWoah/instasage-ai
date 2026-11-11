import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { platformMode, type PlatformMode } from '@/lib/platform';
import { MAX_DAYS, PERIOD_COOKIE, parsePeriod } from '@/lib/period';

// The account picked in the top bar switcher; "all" (or anything unknown) means every account
export const ACCOUNT_COOKIE = 'instasage_account';

export type AccountScope = {
  key: string; // 'all' or a profile id, used to keep AI results per selection
  profileIds: string[];
  profiles: Awaited<ReturnType<typeof prisma.socialProfile.findMany>>;
  mode: PlatformMode; // which vocabulary the pages use for this selection
  days: number | null; // the time window picked in the top bar; null = all time
  span: number; // the window in days, with "all time" resolved to the age of the oldest post
  aiKey: string; // key for cached AI answers: account plus window, since a week and a quarter get different advice
};

export async function getAccountScope(userId: string): Promise<AccountScope> {
  const jar = await cookies();
  const profiles = await prisma.socialProfile.findMany({ where: { userId }, orderBy: { lastSyncedAt: 'desc' } });
  const selected = jar.get(ACCOUNT_COOKIE)?.value;
  const match = profiles.find((p) => p.id === selected);
  const inScope = match ? [match] : profiles;
  const profileIds = inScope.map((p) => p.id);
  const key = match ? match.id : 'all';
  const days = parsePeriod(jar.get(PERIOD_COOKIE)?.value);
  let span = days ?? MAX_DAYS;
  if (days == null && profileIds.length) {
    const first = await prisma.post.aggregate({ where: { socialProfileId: { in: profileIds } }, _min: { publishedAt: true } });
    const oldest = first._min.publishedAt;
    if (oldest) span = Math.min(MAX_DAYS, Math.max(7, Math.ceil((Date.now() - oldest.getTime()) / 86_400_000) + 1));
  }
  return { key, profileIds, profiles: inScope, mode: platformMode(inScope.map((p) => p.platform)), days, span, aiKey: `${key}@${days ?? 'all'}` };
}
