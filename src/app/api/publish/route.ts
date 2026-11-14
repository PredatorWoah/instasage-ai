import { NextResponse } from 'next/server';
import { failed, requireUserId, unauthorized } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { formatLabel } from '@/lib/platform';
import { advance, canPost, checkPost, lastTick, POST_KINDS, postView, readMedia, type PostKind } from '@/services/publish';

export const maxDuration = 60;

// Recent and upcoming posts, and whether everything posting needs is in place
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const account = new URL(req.url).searchParams.get('account');
  try {
    const [posts, tick, allowed] = await Promise.all([
      prisma.scheduledPost.findMany({
        where: { userId, ...(account ? { socialProfileId: account } : {}), OR: [{ status: { in: ['scheduled', 'processing', 'failed'] } }, { status: 'published', publishedAt: { gte: new Date(Date.now() - 14 * 86_400_000) } }] },
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
        take: 60,
      }),
      lastTick(),
      canPost(userId),
    ]);
    return NextResponse.json({ posts: posts.map(postView), uploads: !!process.env.BLOB_READ_WRITE_TOKEN, cronSecret: !!process.env.CRON_SECRET, lastTick: tick, allowed });
  } catch (error) {
    return failed(error, 'Your posting queue');
  }
}

// { account, kind, caption, media: [{ url, type, stored }], scheduledFor?: ISO, ideaId?, draftId? }
// No scheduledFor: it is sent to Instagram straight away and the page polls it until it is live.
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const profile = await prisma.socialProfile.findFirst({ where: { id: String(body.account ?? ''), userId, platform: 'instagram' } });
  if (!profile) return NextResponse.json({ error: 'Pick one of your Instagram accounts.' }, { status: 400 });
  const kind = POST_KINDS.find((k) => k === body.kind) as PostKind | undefined;
  if (!kind) return NextResponse.json({ error: 'Pick what to post: photo, carousel, reel or story.' }, { status: 400 });
  const caption = kind === 'story' ? '' : typeof body.caption === 'string' ? body.caption.trim() : '';
  const media = readMedia(body.media);
  const when = typeof body.scheduledFor === 'string' && !Number.isNaN(Date.parse(body.scheduledFor)) ? new Date(body.scheduledFor) : null;
  if (when && when.getTime() < Date.now() - 60_000) return NextResponse.json({ error: 'That time has passed. Pick a later one, or post now.' }, { status: 400 });

  const problems = await checkPost(userId, profile.id, kind, caption, media);
  if (problems.length) return NextResponse.json({ error: problems.join(' '), problems }, { status: 400 });

  const idea = typeof body.ideaId === 'string' ? await prisma.savedIdea.findFirst({ where: { id: body.ideaId, userId }, select: { id: true } }) : null;
  const draft = typeof body.draftId === 'string' ? await prisma.creativeDraft.findFirst({ where: { id: body.draftId, userId, socialProfileId: profile.id }, select: { id: true } }) : null;
  // One calendar entry per planned post: an entry that already has a post waiting is not given a second one
  if (idea && (await prisma.scheduledPost.count({ where: { ideaId: idea.id, status: { in: ['scheduled', 'processing'] } } }))) {
    return NextResponse.json({ error: 'This calendar entry already has a post waiting. Cancel that one first.' }, { status: 400 });
  }
  try {
    // A scheduled post shows on the calendar: use its entry, or make one
    let ideaId = idea?.id ?? null;
    if (when && !ideaId) {
      const title = (caption.split('\n')[0].trim() || `${formatLabel(kind === 'image' ? 'post' : kind)} for @${profile.username}`).slice(0, 120);
      const created = await prisma.savedIdea.create({ data: { userId, title, format: kind === 'image' ? 'post' : kind, status: 'planned', scheduledFor: when, source: 'manual', ...(caption ? { drafts: { caption } } : {}) } });
      ideaId = created.id;
    } else if (when && ideaId) {
      await prisma.savedIdea.update({ where: { id: ideaId }, data: { scheduledFor: when, status: 'planned' } });
    }
    let post = await prisma.scheduledPost.create({
      data: { userId, socialProfileId: profile.id, kind, caption, media, scheduledFor: when, ideaId, draftId: draft?.id ?? null },
    });
    if (!when) post = await advance(post);
    return NextResponse.json({ post: postView(post) });
  } catch (error) {
    return failed(error, 'Posting');
  }
}
