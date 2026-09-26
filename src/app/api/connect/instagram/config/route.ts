import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { instagramOAuthConfig } from '@/services/instagram';

// Lets the UI show the Connect button only when the app ID and secret are configured
export async function GET() {
  if (!(await requireUserId())) return unauthorized();
  return NextResponse.json({ oauth: instagramOAuthConfig() !== null });
}
