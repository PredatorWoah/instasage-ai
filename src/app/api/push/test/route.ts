import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { buildDigest, sendPush } from '@/services/push';

// Sends this morning's digest (or a hello) to every device, to check notifications work
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const digest = await buildDigest(userId).catch(() => null);
  const result = await sendPush(userId, { ...(digest ?? { title: 'InstaSage notifications are on', body: 'You will get alerts and a morning digest here.' }), url: '/', tag: 'test' });
  if (!result.devices) return NextResponse.json({ error: 'No devices have notifications turned on yet.' }, { status: 400 });
  return NextResponse.json(result);
}
