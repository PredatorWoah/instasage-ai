import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { writeForIdea, type DraftKind } from '@/services/ai';

export const maxDuration = 300;

const KINDS: DraftKind[] = ['script', 'carousel', 'caption'];

// { kind } writes a reel script, carousel outline or caption for this idea and saves it on the idea
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);
  const { id } = await params;
  const { kind } = await req.json().catch(() => ({}));
  if (!KINDS.includes(kind)) return NextResponse.json({ error: 'Pick script, carousel or caption.' }, { status: 400 });
  try {
    return NextResponse.json(await writeForIdea(userId, await getAccountScope(userId), id, kind));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
