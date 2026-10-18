import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';
import { getAccountScope } from '@/lib/scope';
import { IgPermissionError, loadComments, PERMISSION_CODE } from '@/services/comments';

// No ?postId: recent Instagram posts in view, busiest first. With ?postId: its live comments
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const postId = new URL(req.url).searchParams.get('postId');

  if (!postId) {
    const scope = await getAccountScope(userId);
    const ids = scope.profiles.filter((p) => p.platform === 'instagram').map((p) => p.id);
    const posts = await prisma.post.findMany({
      where: { socialProfileId: { in: ids }, publishedAt: { gte: new Date(Date.now() - 60 * 86_400_000) } },
      orderBy: { publishedAt: 'desc' },
      take: 24,
      select: { id: true, caption: true, thumbnail: true, type: true, comments: true, publishedAt: true, socialProfile: { select: { username: true } } },
    });
    return NextResponse.json({ posts: posts.map(({ socialProfile, ...p }) => ({ ...p, username: socialProfile.username })) });
  }

  try {
    const comments = await loadComments(userId, postId);
    if (!comments) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    return NextResponse.json({ comments });
  } catch (error) {
    if (error instanceof IgPermissionError) {
      return NextResponse.json({ error: 'InstaSage is not allowed to read comments yet.', code: PERMISSION_CODE }, { status: 403 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
