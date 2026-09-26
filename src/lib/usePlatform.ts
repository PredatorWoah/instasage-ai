'use client';

import { useSyncExternalStore } from 'react';
import { useCachedJson } from '@/lib/useCachedJson';
import { platformMode, terms } from '@/lib/platform';

// Keep in sync with ACCOUNT_COOKIE in src/lib/scope.ts
export const ACCOUNT_COOKIE = 'instasage_account';
const noopSubscribe = () => () => {};
const readCookie = () => document.cookie.split('; ').find((c) => c.startsWith(`${ACCOUNT_COOKIE}=`))?.split('=')[1] ?? 'all';

export type AccountRow = { id: string; platform: string; username: string; displayName: string };

// Which accounts the switcher points at, and the words and features that go with them
export function usePlatform() {
  const { data } = useCachedJson<AccountRow[]>('/api/accounts');
  const profiles = data ?? [];
  const cookie = useSyncExternalStore(noopSubscribe, readCookie, () => 'all');
  const selected = profiles.some((p) => p.id === cookie) ? cookie : 'all';
  const inScope = selected === 'all' ? profiles : profiles.filter((p) => p.id === selected);
  const mode = platformMode(inScope.map((p) => p.platform));
  return { profiles, selected, current: profiles.find((p) => p.id === selected), mode, t: terms(mode), loaded: data !== undefined };
}
