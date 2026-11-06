import { Suspense } from 'react';
import { ReportsView } from '@/components/reports/ReportsView';

export const metadata = { title: 'Reports' };

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="h-96 rounded-[30px] bg-card animate-pulse" />}>
      <ReportsView />
    </Suspense>
  );
}
