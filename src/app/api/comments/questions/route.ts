import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { PERMISSION_CODE } from '@/services/comments';
import { IgPermissionError } from '@/services/instagram';
import { cachedQuestions, mineQuestions } from '@/services/questions';
import { isDemo } from '@/lib/demo';

// Reading 15 posts' comments takes a few seconds
export const maxDuration = 60;

const FRESH_MS = 6 * 60 * 60 * 1000;

// The questions people asked in comments, grouped by topic. Read again when older than 6 hours, or with ?refresh=1
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const scope = await getAccountScope(userId);
  const ids = scope.profiles.filter((p) => p.platform === 'instagram').map((p) => p.id);
  if (!ids.length) return NextResponse.json({ error: 'Comment questions work for Instagram accounts only.', code: 'no_instagram' }, { status: 400 });
  const force = new URL(req.url).searchParams.get('refresh') === '1';
  const cached = await cachedQuestions(userId, scope.key);
  // The demo has no Instagram: it keeps showing its saved example
  if (cached && (isDemo(userId) || (!force && Date.now() - Date.parse(cached.at) < FRESH_MS))) return NextResponse.json(cached);
  try {
    return NextResponse.json(await mineQuestions(userId, scope.key, ids));
  } catch (error) {
    if (error instanceof IgPermissionError) {
      return NextResponse.json({ error: 'InstaSage is not allowed to read comments yet.', code: PERMISSION_CODE }, { status: 403 });
    }
    // An older read is better than nothing when Instagram is having a moment
    if (cached) return NextResponse.json({ ...cached, stale: (error as Error).message });
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
