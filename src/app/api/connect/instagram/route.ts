import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireUserId } from '@/lib/api';
import { instagramAuthorizeUrl, instagramOAuthConfig } from '@/services/instagram';
import { callbackUrl, STATE_COOKIE } from '@/lib/instagram-oauth';

// Starts Instagram Business Login: redirect to Instagram with a one-time state value
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  if (!(await requireUserId())) return NextResponse.redirect(`${origin}/login`);

  const config = instagramOAuthConfig();
  if (!config) {
    return NextResponse.redirect(`${origin}/accounts?error=${encodeURIComponent('Instagram login is not set up yet. Add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in Vercel.')}`);
  }

  // ?comments=1 also asks for permission to read and answer comments, then returns to the Comments page
  const withComments = new URL(req.url).searchParams.get('comments') === '1';
  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(instagramAuthorizeUrl(config.appId, callbackUrl(req), state, withComments));
  res.cookies.set(STATE_COOKIE, withComments ? `${state}:comments` : state, { httpOnly: true, secure: origin.startsWith('https'), sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
