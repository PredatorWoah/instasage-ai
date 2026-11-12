import Link from 'next/link';
import type { ReactNode } from 'react';

// Sage writes [[post:ID|label]] for posts it mentions; those become links to the post's page.
// Works in server and client components alike.
export function withPostLinks(text: string, className = 'font-semibold text-indigo-400 underline underline-offset-2 hover:text-indigo-300'): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\[\[post:([^|\]]+)\|([^\]]+)\]\]/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    parts.push(text.slice(last, m.index));
    parts.push(
      <Link key={m.index} href={`/content/${encodeURIComponent(m[1].trim())}`} className={className}>
        {m[2].trim()}
      </Link>,
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

// The same text without the link markup, for titles and tooltips
export const plainSage = (text: string) => text.replace(/\[\[post:[^|\]]+\|([^\]]+)\]\]/g, '$1');
