import { Suspense } from 'react';
import { ContentLibraryView } from '@/components/content/ContentLibraryView';

export const metadata = { title: 'Content' };

export default function ContentPage() {
  return (
    <Suspense fallback={<div className="h-96 rounded-[30px] bg-card animate-pulse" />}>
      <ContentLibraryView />
    </Suspense>
  );
}
