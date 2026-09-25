import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AiError } from '@/services/ai';

export async function requireUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// AI errors carry a code the UI uses to show the right hint (add key, sync first, retry)
export function aiErrorResponse(error: unknown) {
  if (error instanceof AiError) {
    const status = error.code === 'api' ? 502 : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error('AI request failed:', error);
  return NextResponse.json({ error: 'Something went wrong talking to Gemini.', code: 'api' }, { status: 500 });
}
