import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Server-side login check before any page renders. It replaces the old in-browser guard,
// which could briefly think a phone was logged out and bounce it to the dashboard.
export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const onLogin = req.nextUrl.pathname === '/login';

  if (onLogin && token) return NextResponse.redirect(new URL('/', req.url));
  if (!onLogin && !token) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}

export const config = {
  // Pages only: API routes check the session themselves, and static files need no check
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
