'use client';

import { useCallback, useEffect, useState } from 'react';
import { primeJson, useCachedJson } from '@/lib/useCachedJson';

type Failure = { error: string; code?: string };
type Fresh = { createdAt: string; model: string; stale: boolean };

// Reads that refresh themselves: show what is cached right away, and when it is missing or older
// than the last sync (or a Sage correction), write a new one in the background, once per page load
const attempted = new Set<string>();

export function useFreshAiRead<T extends Fresh>(url: string, enabled = true) {
  const { data: cached } = useCachedJson<T | null>(enabled ? url : null);
  const [fresh, setFresh] = useState<T | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [updating, setUpdating] = useState(false);

  const refresh = useCallback(async () => {
    attempted.add(url);
    setUpdating(true);
    setFailure(null);
    try {
      const res = await fetch(url, { method: 'POST' });
      const body = await res.json().catch(() => ({ error: 'Unexpected response' }));
      if (res.ok) {
        setFresh(body);
        primeJson(url, body);
      } else setFailure(body);
    } catch {
      setFailure({ error: 'Could not reach the server.' });
    }
    setUpdating(false);
  }, [url]);

  useEffect(() => {
    if (!enabled || cached === undefined || attempted.has(url)) return;
    if (cached !== null && !cached.stale) return;
    // Out of the effect's own tick, so the page paints what is cached first
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [cached, enabled, refresh, url]);

  const result = fresh ?? cached ?? null;
  return { result, failure, updating, loading: enabled && cached === undefined, refresh };
}
