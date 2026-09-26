import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized, saveTimeZone, validTimeZone } from '@/lib/api';

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, timezoneAuto: true } });
  return NextResponse.json({ timeZone: user?.timezone ?? null, auto: user?.timezoneAuto ?? true });
}

// { timeZone, auto }: auto=true follows the device; auto=false pins the zone picked in Settings.
// { detected } comes from the browser on every visit and only applies while auto is on.
export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));

  if ('detected' in body) {
    if (!validTimeZone(body.detected)) return NextResponse.json({ error: 'Unknown timezone' }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, timezoneAuto: true } });
    const changed = user?.timezoneAuto !== false ? await saveTimeZone(userId, body.detected, true) : false;
    return NextResponse.json({ changed });
  }

  if (!validTimeZone(body.timeZone)) return NextResponse.json({ error: 'Pick a timezone from the list.' }, { status: 400 });
  const auto = body.auto !== false;
  const changed = await saveTimeZone(userId, body.timeZone, auto);
  return NextResponse.json({ timeZone: body.timeZone, auto, changed });
}
