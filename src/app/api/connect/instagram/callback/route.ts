import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireUserId } from '@/lib/api';
import { COMMENTS_SCOPE, connectInstagramProfile, exchangeInstagramCode, PUBLISH_SCOPE } from '@/services/instagram';
import { saveGrantedExtras } from '@/services/publish';
import { callbackUrl, STATE_COOKIE } from '@/lib/instagram-oauth';

// Instagram sends the browser back here with ?code=... (or ?error=...)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const saved = (await cookies()).get(STATE_COOKIE)?.value ?? '';
  const [expected, purpose] = saved.split(':');
  const back = (params: Record<string, string>) => {
    const page = !params.connected ? '/accounts' : purpose === 'comments' ? '/comments' : purpose === 'publish' ? '/create?tab=calendar' : '/accounts';
    const join = page.includes('?') ? '&' : '?';
    const res = NextResponse.redirect(`${url.origin}${page}${join}${new URLSearchParams(params)}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  const userId = await requireUserId();
  if (!userId) return NextResponse.redirect(`${url.origin}/login`);

  if (url.searchParams.get('error')) {
    return back({ error: url.searchParams.get('error_description') || 'Instagram login was cancelled.' });
  }

  if (!expected || expected !== url.searchParams.get('state')) {
    return back({ error: 'Login session expired. Click Connect with Instagram again.' });
  }

  const code = url.searchParams.get('code');
  if (!code) return back({ error: 'Instagram did not send a login code. Try again.' });

  try {
    const { token, permissions } = await exchangeInstagramCode(code, callbackUrl(req));
    const profile = await connectInstagramProfile(userId, token);
    // Remember which extra permissions this login has, so the next login asks for them again
    const asked = purpose === 'comments' ? [COMMENTS_SCOPE] : purpose === 'publish' ? [PUBLISH_SCOPE] : [];
    await saveGrantedExtras(userId, permissions, asked).catch((error) => console.error('Saving Instagram permissions failed:', error));
    return back({ connected: profile.username });
  } catch (error) {
    console.error('Instagram connect failed:', error);
    return back({ error: (error as Error).message });
  }
}
