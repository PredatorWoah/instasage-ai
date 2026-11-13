import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { BRIEF_KINDS, type BriefKind } from '@/lib/brandKit';
import { draftWithSage } from '@/services/ai';
import { getKit, ownedAccount } from '@/services/creative';
import { accountVocab } from '@/services/vocab';

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
  const kind = body.kind === 'brief' ? 'brief' : body.kind === 'rewrite' ? 'rewrite' : 'make';
  const briefKind = BRIEF_KINDS.some((k) => k.id === body.briefKind) ? (body.briefKind as BriefKind) : undefined;
  const format = (['caption', 'reel', 'carousel'] as const).find((f) => f === body.format) ?? 'caption';
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);
  try {
    const [kit, vocab] = await Promise.all([getKit(userId, account.id), accountVocab(account.id)]);
    const result = await draftWithSage(userId, account.id, {
      kind, kit, vocab, format, briefKind,
      strict: body.strict !== false,
      productId: str(body.productId, 80),
      cta: str(body.cta, 300),
      topic: str(body.topic, 800),
      fromPostId: str(body.fromPostId, 120),
      instruction: str(body.instruction, 300),
      current: typeof body.currentBody === 'string' ? { body: body.currentBody.slice(0, 3000), hashtags: str(body.currentHashtags, 600) ?? '' } : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
