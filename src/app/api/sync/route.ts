import { NextResponse } from 'next/server';
import { syncSocialProfile } from '@/services/sync';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Instagram syncs fetch insights for up to 50 posts
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { profileId } = await req.json();

    // Verify the profile belongs to the user
    const profile = await prisma.socialProfile.findUnique({
      where: { id: profileId }
    });

    if (!profile || profile.userId !== session.user.id) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    await syncSocialProfile(profileId);

    return NextResponse.json({ success: true, message: 'Sync completed' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
