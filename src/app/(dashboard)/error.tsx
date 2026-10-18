'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/ui/ErrorScreen';

// A page that crashes keeps the header and navigation, so you can always move on
export default function DashboardError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorScreen error={error} retry={unstable_retry} />;
}
