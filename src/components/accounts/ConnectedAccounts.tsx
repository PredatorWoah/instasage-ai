'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type SocialProfile = {
  id: string;
  platform: string;
  username: string;
  displayName: string;
};

const PLATFORMS = [
  { id: 'youtube', name: 'YouTube', color: 'bg-red-500/10 text-red-400 border-red-500/20', available: true },
  { id: 'instagram', name: 'Instagram', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20', available: false },
  { id: 'facebook', name: 'Facebook', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', available: false },
];

export function ConnectedAccounts({ callbackUrl }: { callbackUrl: string }) {
  const [profiles, setProfiles] = useState<SocialProfile[] | null>(null);

  const load = async () => {
    const res = await fetch('/api/accounts');
    setProfiles(res.ok ? await res.json() : []);
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/accounts')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => !cancelled && setProfiles(data))
      .catch(() => !cancelled && setProfiles([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const disconnect = async (profile: SocialProfile) => {
    if (!confirm(`Disconnect ${profile.displayName}? Its synced posts and metrics will be deleted.`)) return;
    const res = await fetch(`/api/accounts?id=${profile.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success(`${profile.displayName} disconnected`);
      load();
    } else {
      toast.error('Failed to disconnect account');
    }
  };

  return (
    <div className="space-y-3">
      {PLATFORMS.map((platform) => {
        const profile = profiles?.find((p) => p.platform === platform.id);
        return (
          <div key={platform.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div className="flex items-center gap-3">
              <Badge className={`text-[11px] border ${platform.color}`}>{platform.name}</Badge>
              <span className="text-xs text-muted-foreground">
                {profiles === null ? 'Loading...' : profile ? profile.displayName : platform.available ? 'Not connected' : 'Coming soon'}
              </span>
            </div>
            {profile ? (
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => disconnect(profile)}>
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                className="text-xs h-7"
                disabled={!platform.available || profiles === null}
                onClick={() => signIn('google', { callbackUrl })}
              >
                Connect
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
