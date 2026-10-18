'use client';

import { unstable_catchError, type ErrorInfo } from 'next/error';

// Wraps a self-contained widget (menu, bell, palette, chat): if it ever throws, it quietly disappears
// instead of taking the whole page down with it. The error still reaches the console for debugging.
function Fallback({ name }: { name: string }, { error }: ErrorInfo) {
  if (typeof window !== 'undefined') console.error(`[${name}] crashed and was hidden:`, error);
  return null;
}

export const Guard = unstable_catchError(Fallback);
