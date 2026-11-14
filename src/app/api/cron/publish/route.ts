import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runQueue } from '@/services/publish';

// Pinged every 5 minutes (cron-job.org, or Vercel Cron on Pro) to send scheduled posts on time.
// Protected by the same CRON_SECRET as the daily sync: "Authorization: Bearer <CRON_SECRET>".
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await runQueue('pinger', 45_000);
  return NextResponse.json(result);
}

export const POST = GET;
