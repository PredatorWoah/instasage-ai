import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';

type Row = { label: string; value: number };
type Audience = Record<'age' | 'gender' | 'country' | 'city', Row[]>;

// Adds up demographics across accounts when "All accounts" is selected
function merge(audiences: Audience[]): Audience | null {
  if (!audiences.length) return null;
  const out = {} as Audience;
  for (const key of ['age', 'gender', 'country', 'city'] as const) {
    const totals = new Map<string, number>();
    for (const a of audiences) for (const r of a[key] ?? []) totals.set(r.label, (totals.get(r.label) ?? 0) + r.value);
    out[key] = [...totals].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }
  return out;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const instagram = (await getAccountScope(userId)).profiles.filter((p) => p.platform === 'instagram');
  if (!instagram.length) return NextResponse.json(null);

  return NextResponse.json({
    username: instagram.map((p) => p.username).join(', @'),
    followerCount: instagram.reduce((a, p) => a + p.followerCount, 0),
    lastSyncedAt: instagram[0].lastSyncedAt,
    audience: merge(instagram.map((p) => p.audience as Audience | null).filter((a): a is Audience => a !== null)),
  });
}
