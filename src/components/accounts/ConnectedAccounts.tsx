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
  {
    id: 'instagram',
    name: 'Instagram',
    color: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    available: true,
    field: 'token',
    placeholder: 'Paste your Instagram access token',
    secret: true,
    help: 'Meta for Developers → your app → Instagram → API setup with Instagram login → Generate token.',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    available: true,
    field: 'channel',
    placeholder: '@yourhandle or channel URL',
    secret: false,
    help: '',
  },
  { id: 'facebook', name: 'Facebook', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', available: false, field: '', placeholder: '', secret: false, help: '' },
];

export function ConnectedAccounts({ onChange }: { onChange?: () => void }) {
  const [profiles, setProfiles] = useState<SocialProfile[] | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState<string | null>(null);

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

  const connect = async (e: React.FormEvent, platform: (typeof PLATFORMS)[number]) => {
    e.preventDefault();
    setConnecting(platform.id);
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: platform.id, [platform.field]: inputs[platform.id] ?? '' }),
    });
    setConnecting(null);
    if (res.ok) {
      const profile = await res.json();
      toast.success(`${profile.displayName} connected`, { description: 'Hit Sync on the Accounts page to pull in your posts.' });
      setInputs((prev) => ({ ...prev, [platform.id]: '' }));
      load();
    } else {
      const { error } = await res.json().catch(() => ({ error: '' }));
      toast.error(`Could not connect ${platform.name}`, { description: error });
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
              <form onSubmit={(e) => connect(e, platform)} className="space-y-1.5">
                <div className="flex gap-2">
                  <Input
                    id={`${platform.id}-connect`}
                    type={platform.secret ? 'password' : 'text'}
                    autoComplete="off"
                    value={inputs[platform.id] ?? ''}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [platform.id]: e.target.value }))}
                    placeholder={platform.placeholder}
                    className="h-8 text-xs bg-secondary/50 border-border"
                    required
                  />
                  <Button type="submit" size="sm" disabled={connecting !== null} className="text-xs h-8 shrink-0">
                    {connecting === platform.id ? 'Connecting...' : 'Connect'}
                  </Button>
                </div>
                {platform.help && <p className="text-[10px] text-muted-foreground">{platform.help}</p>}
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
