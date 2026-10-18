'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useLocalJson } from '@/lib/useLocalJson';

import { THEME_KEY, type ThemeChoice } from '@/lib/themeScript';

export type { ThemeChoice };

const lightQuery = () => window.matchMedia('(prefers-color-scheme: light)');
function subscribeSystem(onChange: () => void) {
  const q = lightQuery();
  q.addEventListener('change', onChange);
  return () => q.removeEventListener('change', onChange);
}

// The chosen theme and what it resolves to right now
export function useTheme() {
  const [choice, setChoice] = useLocalJson<ThemeChoice>(THEME_KEY, 'dark');
  const systemLight = useSyncExternalStore(subscribeSystem, () => lightQuery().matches, () => false);
  const resolved: 'dark' | 'light' = choice === 'system' ? (systemLight ? 'light' : 'dark') : choice === 'light' ? 'light' : 'dark';
  return { choice, resolved, setChoice };
}

// Keeps the <html> class in step with the choice (and the system setting when following it)
export function useApplyTheme() {
  const { resolved } = useTheme();
  useEffect(() => {
    const c = document.documentElement.classList;
    c.toggle('light', resolved === 'light');
    c.toggle('dark', resolved !== 'light');
  }, [resolved]);
  return resolved;
}
