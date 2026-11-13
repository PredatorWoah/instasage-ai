import { prisma } from '@/lib/prisma';
import { BRIEF_KINDS, normalizeKit, presetKit, type BrandKit } from '@/lib/brandKit';
import { forecastDraft } from '@/services/forecast';

const KINDS = ['caption', ...BRIEF_KINDS.map((k) => k.id)];

// Draft contents are free-form but small: anything over 20 KB is refused
const safeData = (v: unknown) => (v && typeof v === 'object' && JSON.stringify(v).length <= 20_000 ? v : null);

// An account id is only usable if it belongs to the signed-in user
export async function ownedAccount(userId: string, accountId: unknown) {
  if (typeof accountId !== 'string') return null;
  return prisma.socialProfile.findFirst({ where: { id: accountId, userId } });
}

// The account's own kit. An account with none yet starts from the Universal preset.
export async function getKit(userId: string, accountId: string): Promise<BrandKit & { saved: boolean }> {
  const row = await prisma.brandKit.findUnique({ where: { userId_socialProfileId: { userId, socialProfileId: accountId } } });
  return row ? { ...normalizeKit(row.data), saved: true } : { ...presetKit('generic'), saved: false };
}

export async function saveKit(userId: string, accountId: string, raw: unknown) {
  const kit = normalizeKit(raw);
  await prisma.brandKit.upsert({
    where: { userId_socialProfileId: { userId, socialProfileId: accountId } },
    create: { userId, socialProfileId: accountId, data: kit as object },
    update: { data: kit as object },
  });
  return kit;
}

// A caption draft carries the forecast made for its wording, so it can be graded once the post is out.
// The forecast is always worked out here: whatever the browser sent in its place is dropped.
// Once the draft is tied to a post the forecast is frozen, since changing it afterwards would be cheating.
async function withForecast(accountId: string, kind: string, data: unknown, frozen?: unknown) {
  if (kind !== 'caption' || !data || typeof data !== 'object') return data;
  const rest = { ...(data as Record<string, unknown>) };
  delete rest.predicted;
  if (frozen) return { ...rest, predicted: frozen };
  const predicted = await forecastDraft(accountId, { format: String(rest.format ?? 'caption'), body: String(rest.body ?? ''), hashtags: String(rest.hashtags ?? '') }).catch(() => null);
  return predicted ? { ...rest, predicted } : rest;
}

export async function listDrafts(userId: string, accountId: string) {
  return prisma.creativeDraft.findMany({ where: { userId, socialProfileId: accountId }, orderBy: { updatedAt: 'desc' }, take: 100 });
}

export async function createDraft(userId: string, accountId: string, input: { kind: unknown; title: unknown; data: unknown; postId?: unknown }) {
  const kind = typeof input.kind === 'string' && KINDS.includes(input.kind) ? input.kind : null;
  if (!kind) return null;
  const title = typeof input.title === 'string' && input.title.trim() ? input.title.trim().slice(0, 160) : kind === 'caption' ? 'Untitled caption' : 'Untitled brief';
  const data = (await withForecast(accountId, kind, safeData(input.data))) ?? {};
  const postId = await ownedPostId(userId, accountId, input.postId);
  return prisma.creativeDraft.create({ data: { userId, socialProfileId: accountId, kind, title, data: data as object, postId } });
}

async function ownedPostId(userId: string, accountId: string, id: unknown) {
  if (typeof id !== 'string' || !id) return null;
  const post = await prisma.post.findFirst({ where: { id, socialProfile: { userId, id: accountId } }, select: { id: true } });
  return post?.id ?? null;
}

export async function updateDraft(userId: string, id: string, input: { title?: unknown; data?: unknown; postId?: unknown }) {
  const draft = await prisma.creativeDraft.findFirst({ where: { id, userId } });
  if (!draft) return null;
  const frozen = draft.postId ? (draft.data as { predicted?: unknown } | null)?.predicted ?? null : null;
  // Linked to a post with no forecast on file: stays without one, rather than getting one after the fact
  const data = safeData(input.data) ? (draft.postId && !frozen ? stripForecast(safeData(input.data)) : await withForecast(draft.socialProfileId, draft.kind, safeData(input.data), frozen)) : null;
  return prisma.creativeDraft.update({
    where: { id },
    data: {
      ...(typeof input.title === 'string' && input.title.trim() ? { title: input.title.trim().slice(0, 160) } : {}),
      ...(data ? { data: data as object } : {}),
      ...('postId' in input ? { postId: await ownedPostId(userId, draft.socialProfileId, input.postId) } : {}),
    },
  });
}

function stripForecast(data: unknown) {
  const rest = { ...(data as Record<string, unknown>) };
  delete rest.predicted;
  return rest;
}

export async function deleteDraft(userId: string, id: string) {
  const { count } = await prisma.creativeDraft.deleteMany({ where: { id, userId } });
  return count > 0;
}

// For a saved caption tied to a post: how that post did, to learn which wording works
export async function draftResults(userId: string, accountId: string) {
  const drafts = await prisma.creativeDraft.findMany({ where: { userId, socialProfileId: accountId, postId: { not: null } }, select: { id: true, postId: true } });
  const posts = drafts.length ? await prisma.post.findMany({ where: { id: { in: drafts.map((d) => d.postId!) } }, select: { id: true, views: true, saves: true, shares: true, performanceScore: true } }) : [];
  const byPost = new Map(posts.map((p) => [p.id, p]));
  return Object.fromEntries(drafts.flatMap((d) => (byPost.has(d.postId!) ? [[d.id, byPost.get(d.postId!)]] : [])));
}
