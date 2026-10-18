import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';
import { DEFAULT_PREFS, deviceLabel, getPrefs, vapidKeys, type NotifyPrefs } from '@/services/push';

// The public key browsers need to subscribe, your notification choices and the devices signed up
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const [{ publicKey }, prefs, devices] = await Promise.all([
    vapidKeys(),
    getPrefs(userId),
    prisma.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true, endpoint: true, device: true, createdAt: true, lastUsedAt: true } }),
  ]);
  return NextResponse.json({ publicKey, prefs, devices });
}

// { subscription } from PushManager.subscribe() adds this device
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const sub = body.subscription;
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : '';
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) {
    return NextResponse.json({ error: 'That subscription looks wrong. Try again.' }, { status: 400 });
  }
  if ((await prisma.pushSubscription.count({ where: { userId } })) >= 20) return NextResponse.json({ error: 'Up to 20 devices. Remove one first.' }, { status: 400 });
  const device = deviceLabel(req.headers.get('user-agent'));
  const row = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh, auth, device },
    update: { userId, p256dh, auth, device },
    select: { id: true },
  });
  return NextResponse.json(row);
}

// { prefs: { digest?, alerts? } }
export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const current = await getPrefs(userId);
  const next: NotifyPrefs = { ...DEFAULT_PREFS, ...current };
  for (const k of ['digest', 'alerts'] as const) if (typeof body.prefs?.[k] === 'boolean') next[k] = body.prefs[k];
  await prisma.user.update({ where: { id: userId }, data: { notifyPrefs: next } });
  return NextResponse.json({ prefs: next });
}

// ?id= or ?endpoint= removes a device
export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const params = new URL(req.url).searchParams;
  const id = params.get('id');
  const endpoint = params.get('endpoint');
  if (!id && !endpoint) return NextResponse.json({ error: 'Which device?' }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { userId, ...(id ? { id } : { endpoint: endpoint! }) } });
  return NextResponse.json({ ok: true });
}
