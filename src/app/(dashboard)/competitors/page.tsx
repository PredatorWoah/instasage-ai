import { Suspense } from 'react';
import { CompetitorsView } from '@/components/competitors/CompetitorsView';

export const metadata = { title: 'Competitors · InstaSage' };

export default function CompetitorsPage() {
  return (
    <Suspense fallback={<div className="h-96 rounded-[30px] bg-card animate-pulse" />}>
      <CompetitorsView />
    </Suspense>
  );
}
