'use client';

import { useCallback, useEffect, useState } from 'react';

// Tiny stale-while-revalidate cache shared by every page: revisiting a tab shows its data
// instantly, then quietly refreshes it in the background.
type Entry = { data: unknown; at: number };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
// Every mounted reader of a URL hears about fresh data, so two panels showing the same thing never disagree
const listeners = new Map<string, Set<(data: unknown) => void>>();
const notify = (url: string, data: unknown) => listeners.get(url)?.forEach((fn) => fn(data));
const FRESH_MS = 30_000;
const TIMEOUT_MS = 20_000;

async function load(url: string) {
  const running = inflight.get(url);
  if (running) return running;
  // A request that never answers (a database waking up, a stuck function) gives up after 20 seconds,
  // so the page can say it did not load instead of showing a placeholder forever
  const promise = fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      cache.set(url, { data, at: Date.now() });
      notify(url, data);
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
    const hear = (fresh: unknown) => setState({ url, data: fresh as T });
    const set = listeners.get(url) ?? listeners.set(url, new Set()).get(url)!;
    set.add(hear);
    return () => {
      set.delete(hear);
    };
  }, [url]);

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

// One URL's data changed (a draft was linked, say): the next reader fetches it again
export function dropJson(url: string) {
  cache.delete(url);
}

// Load a URL again now and hand the result to every page part showing it
export function refreshJson(url: string) {
  cache.delete(url);
  if (listeners.get(url)?.size) load(url).catch(() => {});
}

// Put fresh data straight into the cache (for example right after generating it)
export function primeJson(url: string, data: unknown) {
  cache.set(url, { data, at: Date.now() });
  notify(url, data);
}
