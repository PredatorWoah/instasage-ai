'use client';

import { useCallback, useEffect, useState } from 'react';

// Tiny stale-while-revalidate cache shared by every page: revisiting a tab shows its data
// instantly, then quietly refreshes it in the background.
type Entry = { data: unknown; at: number };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const FRESH_MS = 30_000;

async function load(url: string) {
  const running = inflight.get(url);
  if (running) return running;
  const promise = fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      cache.set(url, { data, at: Date.now() });
      return data;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, promise);
  return promise;
}

// Warm the cache ahead of a click (tab hover or touch)
export function prefetchJson(url: string) {
  const hit = cache.get(url);
  if (!hit || Date.now() - hit.at > FRESH_MS) load(url).catch(() => {});
}

export function useCachedJson<T>(url: string | null) {
  const [data, setData] = useState<T | undefined>(() => (url ? (cache.get(url)?.data as T | undefined) : undefined));

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const hit = cache.get(url);
    if (hit) setData(hit.data as T);
    if (!hit || Date.now() - hit.at > FRESH_MS) {
      load(url)
        .then((fresh) => !cancelled && setData(fresh as T))
        .catch(() => !cancelled && !hit && setData(null as T));
    }
    return () => {
      cancelled = true;
    };
  }, [url]);

  const refresh = useCallback(async () => {
    if (!url) return;
    cache.delete(url);
    setData((await load(url)) as T);
  }, [url]);

  // undefined = still loading the first time
  return { data, loading: data === undefined, refresh };
}

// Mutations (sync, connect, disconnect) make cached data stale
export function clearJsonCache() {
  cache.clear();
}

// Put fresh data straight into the cache (for example right after generating it)
export function primeJson(url: string, data: unknown) {
  cache.set(url, { data, at: Date.now() });
}
