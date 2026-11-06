import { Suspense } from 'react';
import { IdeasStudioView } from '@/components/ideas/IdeasStudioView';

export const metadata = { title: 'Ideas' };

export default function IdeasPage() {
  return (
    <Suspense fallback={<div className="h-96 rounded-[30px] bg-card animate-pulse" />}>
      <IdeasStudioView />
    </Suspense>
  );
}
