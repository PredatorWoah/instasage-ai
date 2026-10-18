'use client';

import { useEffect } from 'react';
import { ErrorScreen } from '@/components/ui/ErrorScreen';

// Catches crashes in the app shell itself (header, layout); pages have their own boundary inside it
export default function AppError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorScreen error={error} retry={unstable_retry} full />;
}
