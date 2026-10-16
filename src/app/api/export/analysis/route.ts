import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { buildExportText, type ExportGoal } from '@/services/ai';

const GOALS: ExportGoal[] = ['plan', 'review', 'ideas', 'ask'];

// Your numbers plus ready-made instructions, as text to paste into any chat AI
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);
  const goal = new URL(req.url).searchParams.get('goal') as ExportGoal;
  if (!GOALS.includes(goal)) return NextResponse.json({ error: 'Unknown goal' }, { status: 400 });
  try {
    const text = await buildExportText(userId, await getAccountScope(userId), goal);
    return NextResponse.json({ text, tokens: Math.round(text.length / 3.6) });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
