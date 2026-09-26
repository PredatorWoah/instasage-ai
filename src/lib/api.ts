import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import { AiError, clearTimedResults } from '@/services/ai';
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
  return NextResponse.json({ error: 'Something went wrong talking to the AI.', code: 'api' }, { status: 500 });
}

export const validTimeZone = (tz: unknown): tz is string => {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// "Asia/Kolkata" and "Asia/Calcutta" are the same place; browsers report either one
const canonical = (tz: string) => new Intl.DateTimeFormat('en', { timeZone: tz }).resolvedOptions().timeZone;
const sameZone = (a: string | null | undefined, b: string) => !!a && validTimeZone(a) && canonical(a) === canonical(b);

// Stores the creator's timezone. Cached AI answers quoted times in the old zone, so they go.
export async function saveTimeZone(userId: string, tz: string, auto: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, timezoneAuto: true } });
  const moved = !sameZone(user?.timezone, tz);
  if (!moved && user?.timezoneAuto === auto) return false;
  await prisma.user.update({ where: { id: userId }, data: { timezone: moved ? tz : user!.timezone, timezoneAuto: auto } });
  if (moved) await clearTimedResults(userId);
  return moved;
}

// The browser reports its timezone in a cookie. Unless one was picked by hand in Settings,
// keep it on the user so the AI (and the daily cron, which has no browser) use local time
export async function rememberTimeZone(userId: string) {
  const tz = (await cookies()).get('tz')?.value;
  if (!validTimeZone(tz)) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, timezoneAuto: true } });
  if (user && user.timezoneAuto && !sameZone(user.timezone, tz)) await saveTimeZone(userId, tz, true);
}

// The zone to show times in: the saved one, else this browser's, else UTC
export async function getTimeZone(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  if (user?.timezone) return user.timezone;
  const tz = (await cookies()).get('tz')?.value;
  return validTimeZone(tz) ? tz : 'UTC';
}
