import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireUserId } from '@/lib/api';
import { META_STATE_COOKIE, metaAuthorizeUrl, metaCallbackUrl, metaOAuthConfig } from '@/services/competitors';

// Starts Facebook Login (only used for looking up competitors)
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  if (!(await requireUserId())) return NextResponse.redirect(`${origin}/login`);
  if (!metaOAuthConfig()) {
    return NextResponse.redirect(`${origin}/competitors?error=${encodeURIComponent('Facebook Login is not set up yet. Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in Vercel, then redeploy.')}`);
  }
  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(metaAuthorizeUrl(metaCallbackUrl(req), state));
  res.cookies.set(META_STATE_COOKIE, state, { httpOnly: true, secure: origin.startsWith('https'), sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
