import { Suspense } from 'react';
import { CreateView } from '@/components/create/CreateView';

export const metadata = { title: 'Create' };

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="h-96 rounded-[30px] glass-panel animate-pulse" />}>
      <CreateView />
    </Suspense>
  );
}
