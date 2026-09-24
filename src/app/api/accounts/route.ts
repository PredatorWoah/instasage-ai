import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { connectYouTubeProfile } from '@/services/youtube';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const accounts = await prisma.socialProfile.findMany({
      where: { userId: session.user.id },
      orderBy: { lastSyncedAt: 'desc' }
    });
    return NextResponse.json(accounts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { channel } = await req.json().catch(() => ({}));
  if (typeof channel !== 'string' || !channel.trim()) {
    return NextResponse.json({ error: 'Enter a YouTube @handle, channel ID or URL' }, { status: 400 });
  }

  try {
    const profile = await connectYouTubeProfile(session.user.id, channel);
    return NextResponse.json(profile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // deleteMany scoped to the user so nobody can remove someone else's profile
  const { count } = await prisma.socialProfile.deleteMany({ where: { id, userId: session.user.id } });
  if (count === 0) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
