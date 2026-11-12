import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { profileIds } = await getAccountScope(userId);
  const posts = await prisma.post.findMany({
    where: { socialProfileId: { in: profileIds } },
    include: { socialProfile: { select: { username: true } } },
    orderBy: { publishedAt: 'desc' },
    take: 500,
  });
  // Sage's one-line verdict on each post it has reviewed, for the library's chips
  const reviews = posts.length ? await prisma.aiResult.findMany({ where: { userId, kind: { in: posts.map((p) => `post:${p.id}`) } }, select: { kind: true, content: true } }) : [];
  const verdicts = new Map(reviews.map((r) => {
    const c = r.content as { verdict?: unknown; bestFor?: unknown };
    return [r.kind.slice(5), { verdict: typeof c.verdict === 'string' ? c.verdict : null, bestFor: typeof c.bestFor === 'string' ? c.bestFor : null }];
  }));
  return NextResponse.json(
    posts.map((p) => ({
      id: p.id,
      type: p.type,
      platform: p.platform,
      thumbnail: p.thumbnail,
      permalink: p.permalink,
      reach: p.reach,
      caption: p.caption,
      views: p.views,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      saves: p.saves,
      performanceScore: Number(p.performanceScore.toFixed(1)),
      isBoosted: p.isBoosted,
      username: p.socialProfile.username,
      publishedAt: p.publishedAt.toISOString(),
      aiVerdict: verdicts.get(p.id)?.verdict ?? null,
      aiBestFor: verdicts.get(p.id)?.bestFor ?? null,
    })),
  );
}
