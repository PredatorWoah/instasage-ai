'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Copy, RotateCw, TriangleAlert } from 'lucide-react';

// Friendly fallback for a crashed page: try again, go home, or copy the details for a bug report
export function ErrorScreen({ error, retry, full }: { error: Error & { digest?: string }; retry: () => void; full?: boolean }) {
  const [copied, setCopied] = useState(false);
  const details = [
    error.digest ? `Error ID: ${error.digest}` : null,
    `Message: ${error.message}`,
    `Page: ${typeof location !== 'undefined' ? location.pathname : ''}`,
    `When: ${new Date().toISOString()}`,
    `Browser: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
  ].filter(Boolean).join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className={full ? 'min-h-screen flex items-center justify-center p-6' : 'py-16 flex justify-center'}>
      <div className="max-w-md w-full rounded-[30px] bg-card border border-ink/[0.06] p-6 sm:p-8 space-y-4">
        <span className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><TriangleAlert className="w-6 h-6 text-amber-400" /></span>
        <div>
          <h1 className="text-2xl font-bold">This part didn&apos;t load</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Something went wrong while drawing this page. Your data is safe. Trying again usually fixes it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={retry} className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-ink text-background text-sm font-bold"><RotateCw className="w-4 h-4" /> Try again</button>
          {full ? (
            // The app shell itself broke, so load the Overview fresh instead of navigating inside it
            <button type="button" onClick={() => location.assign('/')} className="inline-flex items-center h-11 px-4 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-sm font-bold">Overview</button>
          ) : (
            <Link href="/" className="inline-flex items-center h-11 px-4 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-sm font-bold">Overview</Link>
          )}
          <Link href="/status" className="inline-flex items-center h-11 px-4 rounded-full text-sm font-bold text-muted-foreground hover:text-foreground">Status</Link>
        </div>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy error details'}{error.digest ? ` (ID ${error.digest})` : ''}
        </button>
      </div>
    </div>
  );
}
