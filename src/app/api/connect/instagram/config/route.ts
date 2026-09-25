import { NextResponse } from 'next/server';
import { instagramOAuthConfig } from '@/services/instagram';

// Lets the UI show the Connect button only when the app ID and secret are configured
export async function GET() {
  return NextResponse.json({ oauth: instagramOAuthConfig() !== null });
}
