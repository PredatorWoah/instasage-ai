// Email goes out through Resend (resend.com) when RESEND_API_KEY is set. Without the key, nothing is
// sent and the app says so, instead of pretending.

export const emailReady = () => !!process.env.RESEND_API_KEY?.trim();

export const validEmail = (v: unknown): v is string => typeof v === 'string' && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export async function sendEmail(message: { to: string; subject: string; text: string; html: string }): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: 'Email is not set up. Add RESEND_API_KEY in Vercel.' };
  // Resend's shared sender works without a domain, but only delivers to the Resend account's own address
  const from = process.env.DIGEST_EMAIL_FROM?.trim() || 'InstaSage <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, error: body.message || `The email service answered ${res.status}.` };
  } catch (error) {
    return { ok: false, error: (error as Error).name === 'TimeoutError' ? 'The email service took too long.' : 'Could not reach the email service.' };
  }
}
