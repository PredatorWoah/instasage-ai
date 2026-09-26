import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import { AiError } from '@/services/ai';
import { prisma } from '@/lib/prisma';

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

// The browser reports its timezone in a cookie; keep it on the user so the AI (and the
// daily cron, which has no browser) talk about posting times in local time
export async function rememberTimeZone(userId: string) {
  const tz = (await cookies()).get('tz')?.value;
  if (!tz) return;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
  } catch {
    return;
  }
  await prisma.user.updateMany({ where: { id: userId, OR: [{ timezone: null }, { NOT: { timezone: tz } }] }, data: { timezone: tz } });
}
