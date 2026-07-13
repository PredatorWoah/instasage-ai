import { NextResponse } from 'next/server';
import { MetaService } from '@/services/meta';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default-creator-id';
    
    // We pass the userId in the state parameter to link the correct account on callback
    const authUrl = MetaService.getAuthorizationUrl(userId);
    
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Meta authorization redirect:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
