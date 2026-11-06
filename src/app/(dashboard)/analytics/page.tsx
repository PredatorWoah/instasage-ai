import { Suspense } from 'react';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';

export const metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="h-96 rounded-[30px] bg-card animate-pulse" />}>
      <AnalyticsView />
    </Suspense>
  );
}
