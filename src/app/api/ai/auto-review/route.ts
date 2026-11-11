import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { AiError, autoReviewNext } from '@/services/ai';

// Leaves room for retries and falling back to another provider when the chosen AI is busy
export const maxDuration = 300;

// Reviews one recent post that has no AI review yet. The Overview calls this once per visit
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);
  try {
    return NextResponse.json(await autoReviewNext(userId));
  } catch (error) {
    // No AI key is not an error here: there is simply nothing to do
    if (error instanceof AiError && error.code === 'no_key') return NextResponse.json({ reviewed: null, remaining: 0, skipped: 'no_key' });
    return aiErrorResponse(error);
  }
}
