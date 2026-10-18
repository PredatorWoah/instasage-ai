import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId, unauthorized } from '@/lib/api';

const postFields = { id: true, caption: true, thumbnail: true, type: true, platform: true, views: true, performanceScore: true, publishedAt: true, isBoosted: true } as const;

// Every saved idea, with the real post it became (if linked) and the account's average views to compare against
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const [ideas, avg] = await Promise.all([
    prisma.savedIdea.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, include: { post: { select: postFields } } }),
    prisma.post.aggregate({ where: { socialProfile: { userId }, isBoosted: false }, _avg: { views: true, performanceScore: true } }),
  ]);
  const avgViews = avg._avg.views ?? 0;
  const avgEngagement = avg._avg.performanceScore ?? 0;
  return NextResponse.json(ideas.map((i) => ({
    ...i,
    result: i.post && avgViews ? {
      viewsLift: Math.round(((i.post.views - avgViews) / avgViews) * 100),
      engagementLift: avgEngagement ? Math.round(((i.post.performanceScore - avgEngagement) / avgEngagement) * 100) : 0,
    } : null,
  })));
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  if (typeof body.title !== 'string' || !body.title.trim()) return NextResponse.json({ error: 'An idea needs a title.' }, { status: 400 });
  const scheduled = typeof body.scheduledFor === 'string' && !Number.isNaN(Date.parse(body.scheduledFor)) ? new Date(body.scheduledFor) : null;
  const idea = await prisma.savedIdea.create({
    data: {
      userId,
      title: body.title.trim().slice(0, 200),
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 4000) : '',
      format: typeof body.format === 'string' ? body.format.slice(0, 40) : null,
      source: ['plan', 'brainstorm', 'recommendation'].includes(body.source) ? body.source : 'manual',
      ...(scheduled ? { scheduledFor: scheduled, status: 'planned' } : {}),
    },
  });
  return NextResponse.json(idea);
}
