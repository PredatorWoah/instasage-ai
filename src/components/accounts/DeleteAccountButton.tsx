'use client';

import { signOut } from 'next-auth/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function DeleteAccountButton() {
  const handleDelete = async () => {
    if (!confirm('Permanently delete your account and all synced data? This cannot be undone.')) return;
    const res = await fetch('/api/user', { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Failed to delete account');
      return;
    }
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDelete}
      className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
    >
      Delete Account
    </Button>
  );
}
