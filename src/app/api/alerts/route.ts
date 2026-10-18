import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { computeAlerts, dismissAlerts } from '@/services/alerts';

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  return NextResponse.json({ alerts: await computeAlerts(userId) });
}

// { dismiss: id } or { dismiss: 'all' }
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const { dismiss } = await req.json().catch(() => ({}));
  if (dismiss === 'all') await dismissAlerts(userId, (await computeAlerts(userId)).map((a) => a.id));
  else if (typeof dismiss === 'string') await dismissAlerts(userId, [dismiss]);
  return NextResponse.json({ alerts: await computeAlerts(userId) });
}
