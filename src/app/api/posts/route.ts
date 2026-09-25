import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const posts = await prisma.post.findMany({
    where: { socialProfile: { userId } },
    orderBy: { publishedAt: 'desc' },
    take: 500,
  });
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
      publishedAt: p.publishedAt.toISOString(),
    })),
  );
}
