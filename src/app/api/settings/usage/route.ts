import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';

// AI answers over the last 30 days, totalled by feature and by model
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await prisma.aiUsage.findMany({ where: { userId, createdAt: { gte: since } }, select: { feature: true, provider: true, model: true, inputTokens: true, outputTokens: true, cost: true } });

  type Total = { key: string; requests: number; input: number; output: number; cost: number; unpriced: number };
  const add = (map: Map<string, Total>, key: string, r: (typeof rows)[number]) => {
    const t = map.get(key) ?? { key, requests: 0, input: 0, output: 0, cost: 0, unpriced: 0 };
    t.requests += 1;
    t.input += r.inputTokens;
    t.output += r.outputTokens;
    if (r.cost == null) t.unpriced += 1;
    else t.cost += r.cost;
    map.set(key, t);
  };
  const byFeature = new Map<string, Total>();
  const byModel = new Map<string, Total>();
  const all = new Map<string, Total>();
  for (const r of rows) {
    add(byFeature, r.feature, r);
    add(byModel, `${r.provider} · ${r.model}`, r);
    add(all, 'all', r);
  }
  const sort = (m: Map<string, Total>) => [...m.values()].sort((a, b) => b.requests - a.requests);
  return NextResponse.json({ total: all.get('all') ?? { key: 'all', requests: 0, input: 0, output: 0, cost: 0, unpriced: 0 }, byFeature: sort(byFeature), byModel: sort(byModel) });
}
