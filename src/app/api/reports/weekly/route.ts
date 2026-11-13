import { NextResponse } from 'next/server';
import { failed, requireUserId, unauthorized } from '@/lib/api';
import { emailReady } from '@/services/email';
import { getPrefs, sendWeeklyDigest } from '@/services/push';
import { weeklyDigest } from '@/services/weekly';

// The last 7 days and three things to do, plus where the digest gets sent
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  try {
    const [digest, prefs] = await Promise.all([weeklyDigest(userId), getPrefs(userId)]);
    return NextResponse.json({ digest, weekly: prefs.weekly, email: prefs.email, emailReady: emailReady() });
  } catch (error) {
    return failed(error, 'The weekly digest');
  }
}

// Send it now, to every device with notifications on and to the saved email address
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  try {
    return NextResponse.json(await sendWeeklyDigest(userId, true));
  } catch (error) {
    return failed(error, 'Sending the digest');
  }
}
