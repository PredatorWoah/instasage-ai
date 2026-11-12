import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { BRIEF_KINDS, type BriefKind } from '@/lib/brandKit';
import { draftWithSage } from '@/services/ai';
import { getKit, ownedAccount } from '@/services/creative';

// Retries until the caption passes its checks, so leave room for a few tries
export const maxDuration = 300;

// Sage writes a caption or a brief in the account's own brand kit
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);
  const body = await req.json().catch(() => ({}));
  const account = await ownedAccount(userId, body.account);
  if (!account) return NextResponse.json({ error: 'Pick one of your accounts.' }, { status: 400 });
  const kind = body.kind === 'brief' ? 'brief' : 'caption';
  const briefKind = BRIEF_KINDS.some((k) => k.id === body.briefKind) ? (body.briefKind as BriefKind) : undefined;
  try {
    const kit = await getKit(userId, account.id);
    const result = await draftWithSage(userId, account.id, {
      kind, kit, briefKind,
      productId: typeof body.productId === 'string' ? body.productId : undefined,
      cta: typeof body.cta === 'string' ? body.cta.slice(0, 300) : undefined,
      topic: typeof body.topic === 'string' ? body.topic.slice(0, 500) : undefined,
      fromPostId: typeof body.fromPostId === 'string' ? body.fromPostId : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
