import { Suspense } from 'react';
import { CommentsView } from '@/components/comments/CommentsView';

export const metadata = { title: 'Comments · InstaSage' };

export default function CommentsPage() {
  return (
    <Suspense fallback={<div className="h-96 rounded-[30px] bg-card animate-pulse" />}>
      <CommentsView />
    </Suspense>
  );
}
