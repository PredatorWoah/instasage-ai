import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { computeAlerts } from '@/services/alerts';

export type NotifyPrefs = { digest: boolean; alerts: boolean };
export const DEFAULT_PREFS: NotifyPrefs = { digest: true, alerts: true };

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

// VAPID keys identify this app to the browsers' push services. Environment variables win;
// otherwise a pair is generated on first use and kept in the database, so nothing needs setting up.
let cached: { publicKey: string; privateKey: string } | null = null;
export async function vapidKeys() {
  if (cached) return cached;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cached = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return cached;
  }
  const row = await prisma.appConfig.findUnique({ where: { key: 'vapid' } });
  if (row) {
    cached = JSON.parse(row.value);
    return cached!;
  }
  const fresh = webpush.generateVAPIDKeys();
  // Two first requests at once: whichever insert lands first is the pair everyone uses
  await prisma.appConfig.upsert({ where: { key: 'vapid' }, create: { key: 'vapid', value: JSON.stringify(fresh) }, update: {} });
  const saved = await prisma.appConfig.findUniqueOrThrow({ where: { key: 'vapid' } });
  cached = JSON.parse(saved.value);
  return cached!;
}

export function deviceLabel(ua: string | null) {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

export async function getPrefs(userId: string): Promise<NotifyPrefs> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notifyPrefs: true } });
  return { ...DEFAULT_PREFS, ...((user?.notifyPrefs as Partial<NotifyPrefs> | null) ?? {}) };
}

// Sends to every device the user enabled; devices the push service says are gone get removed
export async function sendPush(userId: string, message: PushMessage) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return { sent: 0, failed: 0, devices: 0 };
  const { publicKey, privateKey } = await vapidKeys();
  // Push services want a contact: the site's own https address works and needs no setting
  const site = process.env.NEXTAUTH_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  const subject = process.env.VAPID_SUBJECT || (site.startsWith('https://') ? site : 'mailto:owner@instasage.app');
  let sent = 0;
  let failed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(message),
        { vapidDetails: { subject, publicKey, privateKey }, TTL: 60 * 60 * 12, timeout: 8000 },
      );
      sent++;
      await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    } catch (error) {
      failed++;
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      else console.error('Push failed:', status, (error as Error).message);
    }
  }));
  return { sent, failed, devices: subs.length };
}

// After the morning sync: new alerts (each sent once) and a short digest of yesterday
export async function sendDailyNotifications(userId: string) {
  const subs = await prisma.pushSubscription.count({ where: { userId } });
  if (!subs) return 'no devices';
  const prefs = await getPrefs(userId);
  const out: string[] = [];

  if (prefs.alerts) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { notifiedAlerts: true } });
    const already = new Set((user?.notifiedAlerts as string[] | null) ?? []);
    const fresh = (await computeAlerts(userId)).filter((a) => !already.has(a.id));
    for (const a of fresh.slice(0, 3)) await sendPush(userId, { title: a.title, body: a.body, url: a.href ?? '/', tag: a.id });
    if (fresh.length) {
      await prisma.user.update({ where: { id: userId }, data: { notifiedAlerts: [...already, ...fresh.map((a) => a.id)].slice(-300) } });
      out.push(`${Math.min(3, fresh.length)} alerts`);
    }
  }

  if (prefs.digest) {
    const digest = await buildDigest(userId);
    if (digest) {
      await sendPush(userId, { ...digest, url: '/', tag: 'digest' });
      out.push('digest');
    }
  }
  return out.join(', ') || 'nothing new';
}

// One line per account: follower change since yesterday's snapshot, plus the best recent post
export async function buildDigest(userId: string): Promise<{ title: string; body: string } | null> {
  const profiles = await prisma.socialProfile.findMany({ where: { userId }, select: { id: true, username: true, platform: true, followerCount: true } });
  if (!profiles.length) return null;
  const dayAgo = new Date(Date.now() - 30 * 3_600_000);
  // Instagram followers and YouTube subscribers are added up separately, never mixed
  const gained = { followers: 0, subscribers: 0 };
  const seen = { followers: false, subscribers: false };
  const parts: string[] = [];
  for (const p of profiles) {
    const before = await prisma.metric.findFirst({
      where: { socialProfileId: p.id, followers: { not: null }, date: { lte: dayAgo } },
      orderBy: { date: 'desc' },
      select: { followers: true },
    });
    if (before?.followers == null) continue;
    const diff = p.followerCount - before.followers;
    const unit = p.platform === 'youtube' ? 'subscribers' : 'followers';
    gained[unit] += diff;
    seen[unit] = true;
    parts.push(`@${p.username} ${diff >= 0 ? '+' : ''}${diff}`);
  }
  const best = await prisma.post.findFirst({
    where: { socialProfile: { userId }, publishedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    orderBy: { views: 'desc' },
    select: { caption: true, views: true },
  });
  if (!parts.length && !best) return null;
  const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;
  const totals = (['followers', 'subscribers'] as const).filter((u) => seen[u]).map((u) => `${signed(gained[u])} ${u}`);
  const title = totals.length ? `${totals.join(' · ')} since yesterday` : 'Your morning update';
  const body = [parts.length > 1 ? parts.join(' · ') : '', best ? `Top post this week: "${best.caption.replace(/\s+/g, ' ').slice(0, 60) || 'Untitled'}" with ${best.views.toLocaleString()} views` : ''].filter(Boolean).join('\n');
  return { title, body: body || 'Your numbers are fresh. Open InstaSage for the details.' };
}
