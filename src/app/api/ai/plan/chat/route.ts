import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone, failed } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { changePlan, planChat, undoPlanChange } from '@/services/ai';

// Rewriting a whole plan is a long answer
export const maxDuration = 300;

// The conversation so far, and whether there is a change to undo
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  try {
    return NextResponse.json(await planChat(userId, await getAccountScope(userId)));
  } catch (error) {
    return failed(error, 'The plan chat');
  }
}

// { message } asks Sage for a change; { undo: true } puts the plan back to before the last change
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const scope = await getAccountScope(userId);
  if (body.undo === true) {
    const done = await undoPlanChange(userId, scope).catch(() => null);
    return done ? NextResponse.json(done) : NextResponse.json({ error: 'Nothing to undo.' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return NextResponse.json({ error: 'Say what to change.' }, { status: 400 });
  await rememberTimeZone(userId);
  try {
    return NextResponse.json(await changePlan(userId, scope, message));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
