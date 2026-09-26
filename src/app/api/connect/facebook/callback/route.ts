import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireUserId } from '@/lib/api';
import { META_STATE_COOKIE, connectMeta, metaCallbackUrl } from '@/services/competitors';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (params: Record<string, string>) => {
    const res = NextResponse.redirect(`${url.origin}/competitors?${new URLSearchParams(params)}`);
    res.cookies.delete(META_STATE_COOKIE);
    return res;
  };

  const userId = await requireUserId();
  if (!userId) return NextResponse.redirect(`${url.origin}/login`);
  if (url.searchParams.get('error')) return back({ error: url.searchParams.get('error_description') || 'Facebook login was cancelled.' });

  const expected = (await cookies()).get(META_STATE_COOKIE)?.value;
  if (!expected || expected !== url.searchParams.get('state')) return back({ error: 'Login session expired. Press Connect with Facebook again.' });

  const code = url.searchParams.get('code');
  if (!code) return back({ error: 'Facebook did not send a login code. Try again.' });

  try {
    const link = await connectMeta(userId, code, metaCallbackUrl(req));
    return back({ connected: link.igUsername });
  } catch (error) {
    console.error('Facebook connect failed:', error);
    return back({ error: (error as Error).message });
  }
}
