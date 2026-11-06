import { Suspense } from 'react';
import { AccountView } from '@/components/account/AccountView';

export const metadata = { title: 'Profile' };

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="h-96 rounded-[30px] bg-card animate-pulse" />}>
      <AccountView />
    </Suspense>
  );
}
