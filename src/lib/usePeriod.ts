'use client';

import { useSyncExternalStore } from 'react';
import { PERIOD_COOKIE, parsePeriod, periodCookie, periodLabel, periodPhrase } from '@/lib/period';

const noopSubscribe = () => () => {};
const readCookie = () => document.cookie.split('; ').find((c) => c.startsWith(`${PERIOD_COOKIE}=`))?.split('=')[1] ?? '';

// The top bar's time window, read from the same cookie the server uses
export function usePeriod() {
  const raw = useSyncExternalStore(noopSubscribe, readCookie, () => '');
  const days = parsePeriod(raw || undefined);
  return { days, label: periodLabel(days), phrase: periodPhrase(days) };
}

// Every page, chart and AI answer reads the window, so reload to refetch everything
export function setPeriod(days: number | null) {
  document.cookie = periodCookie(days);
  window.location.reload();
}
