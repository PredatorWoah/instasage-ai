import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized, aiErrorResponse, rememberTimeZone } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { brainstormReply, type ChatTurn } from '@/services/ai';

export const maxDuration = 300;

// Sends a message to a thread ("new" starts one) and returns the thread's new messages
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  await rememberTimeZone(userId);
  const { id } = await params;
  const { content } = await req.json().catch(() => ({}));
  if (typeof content !== 'string' || !content.trim()) return NextResponse.json({ error: 'Type something first.' }, { status: 400 });
  const message = content.trim().slice(0, 6000);

  const scope = await getAccountScope(userId);
  const thread = id === 'new'
    ? await prisma.ideaThread.create({ data: { userId, scopeKey: scope.key, title: message.replace(/\s+/g, ' ').slice(0, 60) } })
    : await prisma.ideaThread.findFirst({ where: { id, userId } });
  if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const earlier = await prisma.ideaMessage.findMany({ where: { threadId: thread.id }, orderBy: { createdAt: 'asc' }, select: { role: true, content: true } });
  const history = earlier.map((m) => ({ role: m.role, content: m.content }) as ChatTurn);

  try {
    const { text, model } = await brainstormReply(userId, scope, history, message);
    // Both turns are stored only once the AI has answered, so a failure leaves the thread clean
    const [userMsg, reply] = await prisma.$transaction([
      prisma.ideaMessage.create({ data: { threadId: thread.id, role: 'user', content: message } }),
      prisma.ideaMessage.create({ data: { threadId: thread.id, role: 'assistant', content: text, model } }),
      prisma.ideaThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } }),
    ]);
    return NextResponse.json({ threadId: thread.id, title: thread.title, messages: [userMsg, reply] });
  } catch (error) {
    if (id === 'new') await prisma.ideaThread.delete({ where: { id: thread.id } }).catch(() => {});
    return aiErrorResponse(error);
  }
}
