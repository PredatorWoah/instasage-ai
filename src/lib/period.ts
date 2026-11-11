// The time window picked in the top bar. Every page, chart and AI answer reads it.
// Stored in a cookie so server pages and API routes see the same choice as the browser.

export const PERIOD_COOKIE = 'instasage_period';
export const DEFAULT_DAYS = 30;
export const MAX_DAYS = 730;
export const PERIOD_PRESETS = [7, 14, 30, 60, 90, 180, 365] as const;

// Cookie value → number of days, or null for all time
export function parsePeriod(value: string | undefined | null): number | null {
  if (value === 'all') return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_DAYS) : DEFAULT_DAYS;
}

export function periodLabel(days: number | null) {
  if (days == null) return 'All time';
  if (days === 1) return 'Last 24 hours';
  if (days === 365) return 'Last 12 months';
  return `Last ${days} days`;
}

// "7 days", "2 weeks", "3 months": for sentences like "in the last ..."
export function periodPhrase(days: number | null) {
  if (days == null) return 'all time';
  if (days === 1) return 'the last day';
  if (days % 30 === 0 && days >= 60) return `the last ${days / 30} months`;
  if (days % 7 === 0 && days >= 14 && days <= 56) return `the last ${days / 7} weeks`;
  return `the last ${days} days`;
}

export const periodShort = (days: number | null) => (days == null ? 'All' : days % 365 === 0 ? `${days / 365}y` : `${days}d`);

export const periodCookie = (days: number | null) => `${PERIOD_COOKIE}=${days == null ? 'all' : days}; path=/; max-age=31536000; samesite=lax`;
