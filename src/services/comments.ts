import { prisma } from '@/lib/prisma';
import { getInstagramComments, hideInstagramComment, IgPermissionError, replyToInstagramComment } from '@/services/instagram';

export type CommentRow = {
  id: string;
  username: string;
  text: string;
  at: string;
  likes: number;
  hidden: boolean;
  answered: boolean;
  replies: { id: string; username: string; text: string; at: string; mine: boolean }[];
};

export const PERMISSION_CODE = 'needs_comment_permission';

// The post, its account and that account's token, only when the post belongs to this user
export async function ownedInstagramPost(userId: string, postId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, platform: 'instagram', socialProfile: { userId } },
    select: { id: true, socialProfile: { select: { username: true, accessToken: true, isConnected: true } } },
  });
  if (!post?.socialProfile.accessToken) return null;
  return { id: post.id, username: post.socialProfile.username, token: post.socialProfile.accessToken };
}

export async function loadComments(userId: string, postId: string): Promise<CommentRow[] | null> {
  const post = await ownedInstagramPost(userId, postId);
  if (!post) return null;
  const raw = await getInstagramComments(post.token, post.id);
  const me = post.username.toLowerCase();
  return raw
    .filter((c) => (c.username ?? '').toLowerCase() !== me)
    .map((c) => {
      const replies = (c.replies?.data ?? []).map((r) => ({ id: r.id, username: r.username ?? '', text: r.text ?? '', at: r.timestamp, mine: (r.username ?? '').toLowerCase() === me }))
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      return {
        id: c.id,
        username: c.username ?? 'someone',
        text: c.text ?? '',
        at: c.timestamp,
        likes: c.like_count ?? 0,
        hidden: !!c.hidden,
        answered: replies.some((r) => r.mine),
        replies,
      };
    })
    .sort((a, b) => Number(a.answered) - Number(b.answered) || Date.parse(b.at) - Date.parse(a.at));
}

// Replies and hiding act on a comment id; check it really sits under this post first
async function commentOnPost(userId: string, postId: string, commentId: string) {
  const post = await ownedInstagramPost(userId, postId);
  if (!post || !/^\d{5,30}$/.test(commentId)) return null;
  const comments = await getInstagramComments(post.token, post.id);
  return comments.some((c) => c.id === commentId) ? post : null;
}

export async function replyToComment(userId: string, postId: string, commentId: string, message: string) {
  const post = await commentOnPost(userId, postId, commentId);
  if (!post) return null;
  return replyToInstagramComment(post.token, commentId, message);
}

export async function setCommentHidden(userId: string, postId: string, commentId: string, hide: boolean) {
  const post = await commentOnPost(userId, postId, commentId);
  if (!post) return null;
  return hideInstagramComment(post.token, commentId, hide);
}

export { IgPermissionError };
