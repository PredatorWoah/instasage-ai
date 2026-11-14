import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { DEMO_ID, DEMO_MESSAGE } from '@/lib/demo';

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Server-side login check before any page renders. It replaces the old in-browser guard,
// which could briefly think a phone was logged out and bounce it to the dashboard.
// API routes check the session themselves; here they are only checked for the demo, which may read
// but never change anything: no saving, syncing, posting or deleting, whatever the page tries.
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (path.startsWith('/api/')) {
    if (token?.sub === DEMO_ID && !READS.has(req.method) && !path.startsWith('/api/auth/')) {
      return NextResponse.json({ error: DEMO_MESSAGE, code: 'demo' }, { status: 403 });
    }
    return NextResponse.next();
  }

  const onLogin = path === '/login';
  if (onLogin && token) return NextResponse.redirect(new URL('/', req.url));
  if (!onLogin && !token) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}

export const config = {
  // Everything except static files. API routes are included (by path, never by file extension) so the
  // demo check can't be stepped around with a dotted URL.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico$|icons/|sw\\.js$|offline\\.html$|manifest\\.webmanifest$).*)'],
};
