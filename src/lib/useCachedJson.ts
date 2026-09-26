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
  const initial = () => (url ? (cache.get(url)?.data as T | undefined) : undefined);
  const [state, setState] = useState<{ url: string | null; data: T | undefined }>(() => ({ url, data: initial() }));

  // A new URL shows whatever is cached for it straight away (derived during render, no extra pass)
  let data = state.data;
  if (state.url !== url) {
    data = initial();
    setState({ url, data });
  }

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const hit = cache.get(url);
    if (!hit || Date.now() - hit.at > FRESH_MS) {
      load(url)
        .then((fresh) => !cancelled && setState({ url, data: fresh as T }))
        .catch(() => !cancelled && !hit && setState({ url, data: null as T }));
    }
    return () => {
      cancelled = true;
    };
  }, [url]);

  const refresh = useCallback(async () => {
    if (!url) return;
    cache.delete(url);
    const fresh = (await load(url)) as T;
    setState({ url, data: fresh });
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
