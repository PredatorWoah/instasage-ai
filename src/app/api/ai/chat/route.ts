import { NextResponse } from 'next/server';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { prisma } from '@/lib/prisma';
import { chatWithAssistant, type ChatTurn } from '@/services/ai';

// Leaves room for retries and falling back to another provider when the chosen AI is busy
export const maxDuration = 300;

// The conversation with Sage is kept on the server, so it is still there after closing the site,
// and the same on the phone and the laptop. The last 40 messages are kept.
type Action = { id: string | null; ok: boolean; summary: string; undone?: boolean };
type Stored = { role: 'user' | 'assistant'; content: string; at: string; actions?: Action[] };
const key = (userId: string) => `sagechat:${userId}`;

async function load(userId: string): Promise<Stored[]> {
  const row = await prisma.appConfig.findUnique({ where: { key: key(userId) } });
  try {
    const list = row ? (JSON.parse(row.value) as Stored[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
const store = (userId: string, turns: Stored[]) => {
  const value = JSON.stringify(turns.slice(-40));
  return prisma.appConfig.upsert({ where: { key: key(userId) }, create: { key: key(userId), value }, update: { value } });
};

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const turns = await load(userId);
  // A change undone since (here or anywhere else) shows as undone
  const ids = turns.flatMap((t) => (t.actions ?? []).map((a) => a.id).filter((x): x is string => !!x));
  const active = new Set(ids.length ? (await prisma.sageAction.findMany({ where: { id: { in: ids }, userId, active: true }, select: { id: true } })).map((a) => a.id) : []);
  return NextResponse.json({ turns: turns.map((t) => ({ ...t, actions: t.actions?.map((a) => ({ ...a, undone: a.ok && !!a.id && !active.has(a.id) })) })) });
}

// Starts a new conversation
export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await prisma.appConfig.deleteMany({ where: { key: key(userId) } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);

  const { message } = await req.json().catch(() => ({}));
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Type a message first.' }, { status: 400 });
  }
  const saved = await load(userId);
  const turns: ChatTurn[] = saved.slice(-20).map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));

  try {
    const { reply, actions } = await chatWithAssistant(userId, await getAccountScope(userId), turns, message.slice(0, 4000));
    const now = new Date().toISOString();
    await store(userId, [...saved, { role: 'user', content: message.slice(0, 4000), at: now }, { role: 'assistant', content: reply, at: now, actions }]).catch((error) => console.error('Saving the Sage chat failed:', error));
    return NextResponse.json({ reply, actions });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
