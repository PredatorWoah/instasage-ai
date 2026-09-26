import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireUserId } from '@/lib/api';
import { connectInstagramProfile, exchangeInstagramCode } from '@/services/instagram';
import { callbackUrl, STATE_COOKIE } from '@/lib/instagram-oauth';

// Instagram sends the browser back here with ?code=... (or ?error=...)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (params: Record<string, string>) => {
    const res = NextResponse.redirect(`${url.origin}/accounts?${new URLSearchParams(params)}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  const userId = await requireUserId();
  if (!userId) return NextResponse.redirect(`${url.origin}/login`);

  if (url.searchParams.get('error')) {
    return back({ error: url.searchParams.get('error_description') || 'Instagram login was cancelled.' });
  }

  const expected = (await cookies()).get(STATE_COOKIE)?.value;
  if (!expected || expected !== url.searchParams.get('state')) {
    return back({ error: 'Login session expired. Click Connect with Instagram again.' });
  }

  const code = url.searchParams.get('code');
  if (!code) return back({ error: 'Instagram did not send a login code. Try again.' });

  try {
    const token = await exchangeInstagramCode(code, callbackUrl(req));
    const profile = await connectInstagramProfile(userId, token);
    return back({ connected: profile.username });
  } catch (error) {
    console.error('Instagram connect failed:', error);
    return back({ error: (error as Error).message });
  }
}
