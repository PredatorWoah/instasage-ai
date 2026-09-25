'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

export function ConnectedAccounts({ onChange }: { onChange?: () => void }) {
  const [profiles, setProfiles] = useState<SocialProfile[] | null>(null);
  const [channel, setChannel] = useState('');
  const [connecting, setConnecting] = useState(false);

  const load = async () => {
    const res = await fetch('/api/accounts');
    setProfiles(res.ok ? await res.json() : []);
    onChange?.();
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

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel }),
    });
    setConnecting(false);
    if (res.ok) {
      const profile = await res.json();
      toast.success(`${profile.displayName} connected`, { description: 'Hit Sync on the Accounts page to pull in videos.' });
      setChannel('');
      load();
    } else {
      const { error } = await res.json().catch(() => ({ error: '' }));
      toast.error('Could not connect channel', { description: error });
    }
  };

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
        const canConnect = platform.available && profiles !== null && !profile;
        return (
          <div key={platform.id} className="py-2 border-b border-border last:border-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Badge className={`text-[11px] border ${platform.color}`}>{platform.name}</Badge>
                <span className="text-xs text-muted-foreground truncate">
                  {profiles === null ? 'Loading...' : profile ? profile.displayName : platform.available ? 'Not connected' : 'Coming soon'}
                </span>
              </div>
              {profile && (
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => disconnect(profile)}>
                  Disconnect
                </Button>
              )}
            </div>
            {canConnect && (
              <form onSubmit={connect} className="flex gap-2">
                <Input
                  id="youtube-channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="@yourhandle or channel URL"
                  className="h-8 text-xs bg-secondary/50 border-border"
                  required
                />
                <Button type="submit" size="sm" disabled={connecting} className="text-xs h-8 shrink-0">
                  {connecting ? 'Connecting...' : 'Connect'}
                </Button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
