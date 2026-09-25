import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// The account picked in the top bar switcher; "all" (or anything unknown) means every account
export const ACCOUNT_COOKIE = 'instasage_account';

export type AccountScope = {
  key: string; // 'all' or a profile id, used to keep AI results per selection
  profileIds: string[];
  profiles: Awaited<ReturnType<typeof prisma.socialProfile.findMany>>;
};

export async function getAccountScope(userId: string): Promise<AccountScope> {
  const profiles = await prisma.socialProfile.findMany({ where: { userId }, orderBy: { lastSyncedAt: 'desc' } });
  const selected = (await cookies()).get(ACCOUNT_COOKIE)?.value;
  const match = profiles.find((p) => p.id === selected);
  const inScope = match ? [match] : profiles;
  return { key: match ? match.id : 'all', profileIds: inScope.map((p) => p.id), profiles: inScope };
}
