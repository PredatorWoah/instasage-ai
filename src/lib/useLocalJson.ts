'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Small per-browser preferences (saved filters, theme). Storage can be blocked in private windows,
// so every read and write is guarded and the fallback is used instead.
const EVENT = 'instasage:local';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useLocalJson<T>(key: string, fallback: T): [T, (value: T | undefined) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  let value = fallback;
  if (raw != null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {}
  }
  const set = useCallback((v: T | undefined) => writeLocal(key, v), [key]);
  return [value, set];
}

export function readLocal<T>(key: string): T | null {
  const raw = read(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
