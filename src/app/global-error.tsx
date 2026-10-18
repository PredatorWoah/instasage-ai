'use client';

import { useEffect } from 'react';

// Last resort when the root layout itself fails: plain HTML, no app styles or fonts available
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0F', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: 24, textAlign: 'center' }}>
        <title>InstaSage</title>
        <main>
          <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>InstaSage hit a snag</h1>
          <p style={{ color: '#A9A9B8', margin: '0 0 20px' }}>Reload to try again.{error.digest ? ` Error ID ${error.digest}.` : ''}</p>
          <button onClick={() => unstable_retry()} style={{ border: 0, borderRadius: 999, background: '#fff', color: '#0A0A0F', fontWeight: 700, padding: '12px 22px', fontSize: 14, cursor: 'pointer' }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
