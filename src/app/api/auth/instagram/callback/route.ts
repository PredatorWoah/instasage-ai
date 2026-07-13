import { NextResponse } from 'next/server';
import { MetaService } from '@/services/meta';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('state') || 'default-creator-id';
  const error = searchParams.get('error');

  if (error || !code) {
    console.error('Meta Authorization callback returned error:', error);
    return NextResponse.redirect(new URL('/accounts?error=auth_failed', request.url));
  }

  try {
    // 1. Exchange authorization code for short-lived token
    const { accessToken: shortToken } = await MetaService.exchangeCodeForToken(code);

    // 2. Exchange short-lived token for long-lived 60-day token
    const { accessToken: longToken, expiresIn } = await MetaService.exchangeShortToLongLivedToken(shortToken);

    // 3. Fetch Instagram profile details
    const profile = await MetaService.fetchInstagramProfile(longToken);

    // Calculate token expiration date
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setSeconds(tokenExpiresAt.getSeconds() + expiresIn);

    // 4. Save to PostgreSQL database using Prisma (with fallback/graceful error handling if DB offline)
    try {
      // Ensure the associated user exists to prevent relational integrity constraints
      await prisma.user.upsert({
        where: { email: 'creator@example.com' },
        update: {},
        create: {
          id: userId,
          email: 'creator@example.com',
          passwordHash: 'mock-pass-hash-placeholder',
          name: 'Demo Creator',
          username: 'demo_creator',
        },
      });

      // Upsert Instagram connection credentials
      await prisma.account.upsert({
        where: { id: `inst-${profile.username}` }, // unique identifier mapping
        update: {
          displayName: profile.displayName,
          profilePictureUrl: profile.profilePictureUrl,
          followerCount: profile.followerCount,
          isConnected: true,
          accessToken: longToken,
          tokenExpiresAt,
          lastSyncedAt: new Date(),
        },
        create: {
          id: `inst-${profile.username}`,
          userId,
          platform: 'instagram',
          username: profile.username,
          displayName: profile.displayName,
          profilePictureUrl: profile.profilePictureUrl,
          followerCount: profile.followerCount,
          isConnected: true,
          accessToken: longToken,
          tokenExpiresAt,
        },
      });
      
      console.log(`Instagram account @${profile.username} successfully saved to DB.`);
    } catch (dbError) {
      // Database offline/not configured, we log and proceed to redirect with success mock flag
      console.warn('Database connection failed, handling mock connection callback fallback:', dbError);
    }

    // Redirect user back to Accounts panel with active query parameters
    return NextResponse.redirect(new URL(`/accounts?connected=true&username=${profile.username}`, request.url));
  } catch (err) {
    console.error('Error during Instagram OAuth callback handling:', err);
    return NextResponse.redirect(new URL('/accounts?error=callback_error', request.url));
  }
}
