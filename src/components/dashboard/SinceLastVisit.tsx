'use client';

import { useEffect } from 'react';
import { readLocal, useLocalJson, writeLocal } from '@/lib/useLocalJson';
import { ageOf, formatNumber } from '@/utils/formatters';

type Visit = { at: number; followers: number };
const GAP_MS = 30 * 60_000; // coming back within half an hour is the same visit

// "Since your last visit (2 days ago): +12 followers · 1 new post". Remembered per browser and per account view.
export function SinceLastVisit({ scopeKey, followers, unit, postTimes, post, posts }: {
  scopeKey: string;
  followers: number;
  unit: string;
  postTimes: string[];
  post: string;
  posts: string;
}) {
  const base = `instasage:visit:${scopeKey}`;
  const [prev] = useLocalJson<Visit | null>(`${base}:prev`, null);

  useEffect(() => {
    const curr = readLocal<Visit>(`${base}:curr`);
    const now = Date.now();
    if (curr && now - curr.at > GAP_MS) writeLocal(`${base}:prev`, curr);
    writeLocal(`${base}:curr`, { at: now, followers });
  }, [base, followers]);

  if (!prev) return null;
  const diff = followers - prev.followers;
  const fresh = postTimes.filter((t) => Date.parse(t) > prev.at).length;
  if (diff === 0 && fresh === 0) return null;
  const parts = [
    diff !== 0 ? `${diff > 0 ? '+' : '−'}${formatNumber(Math.abs(diff))} ${unit}` : null,
    fresh ? `${fresh} new ${fresh === 1 ? post : posts}` : null,
  ].filter(Boolean);
  return (
    <p className="text-[13px] font-semibold text-white/90">
      Since your last visit {ageOf(prev.at)}: {parts.join(' · ')}
    </p>
  );
}
