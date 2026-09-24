import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const profileFields = { name: true, username: true, email: true, bio: true, image: true } as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: profileFields });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; username?: string; bio?: string } = {};
  for (const key of ['name', 'username', 'bio'] as const) {
    if (typeof body[key] === 'string') data[key] = body[key].trim().slice(0, 500);
  }

  const user = await prisma.user.update({ where: { id: session.user.id }, data, select: profileFields });
  return NextResponse.json(user);
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Accounts, sessions and social profiles (with posts and metrics) cascade
  await prisma.user.delete({ where: { id: session.user.id } });
  return NextResponse.json({ success: true });
}
