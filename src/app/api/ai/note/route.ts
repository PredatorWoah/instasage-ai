import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { generatePageNote, getCachedPageNote, type NotePage } from '@/services/ai';

export const maxDuration = 300;

const PAGES: NotePage[] = ['analytics', 'content', 'audience'];
const pageOf = (req: Request) => {
  const page = new URL(req.url).searchParams.get('page') as NotePage;
  return PAGES.includes(page) ? page : null;
};

// Sage's short read of one page, cached per account and time window
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const page = pageOf(req);
  if (!page) return NextResponse.json({ error: 'Unknown page' }, { status: 400 });
  return NextResponse.json(await getCachedPageNote(userId, await getAccountScope(userId), page));
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const page = pageOf(req);
  if (!page) return NextResponse.json({ error: 'Unknown page' }, { status: 400 });
  await rememberTimeZone(userId);
  try {
    return NextResponse.json(await generatePageNote(userId, await getAccountScope(userId), page));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
