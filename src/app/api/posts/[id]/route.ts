import { NextResponse } from 'next/server';
import { requireUserId, unauthorized } from '@/lib/api';
import { getPostWithBenchmarks } from '@/services/ai';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  const data = await getPostWithBenchmarks(userId, id);
  if (!data) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const { socialProfile, ...post } = data.post;
  return NextResponse.json({
    post: { ...post, publishedAt: post.publishedAt.toISOString(), username: socialProfile.username },
    benchmarks: data.benchmarks,
  });
}
