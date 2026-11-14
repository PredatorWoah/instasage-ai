import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireUserId } from '@/lib/api';
import { COMMENTS_SCOPE, instagramAuthorizeUrl, instagramOAuthConfig, PUBLISH_SCOPE } from '@/services/instagram';
import { grantedExtras } from '@/services/publish';
import { callbackUrl, STATE_COOKIE } from '@/lib/instagram-oauth';

// Starts Instagram Business Login: redirect to Instagram with a one-time state value
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  if (!(await requireUserId())) return NextResponse.redirect(`${origin}/login`);

  const config = instagramOAuthConfig();
  if (!config) {
    return NextResponse.redirect(`${origin}/accounts?error=${encodeURIComponent('Instagram login is not set up yet. Add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in Vercel.')}`);
  }

  // ?comments=1 also asks to read and answer comments, ?publish=1 to post. Either way every extra
  // permission allowed before is asked for again, since the new token replaces the old one.
  const params = new URL(req.url).searchParams;
  const purpose = params.get('comments') === '1' ? 'comments' : params.get('publish') === '1' ? 'publish' : '';
  const userId = (await requireUserId())!;
  const extras = [...(await grantedExtras(userId)), ...(purpose === 'comments' ? [COMMENTS_SCOPE] : purpose === 'publish' ? [PUBLISH_SCOPE] : [])];
  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(instagramAuthorizeUrl(config.appId, callbackUrl(req), state, extras));
  res.cookies.set(STATE_COOKIE, purpose ? `${state}:${purpose}` : state, { httpOnly: true, secure: origin.startsWith('https'), sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
