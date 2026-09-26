'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clearJsonCache } from '@/lib/useCachedJson';
import { YouTubeConnect } from './YouTubeConnect';

type SocialProfile = { id: string; platform: string; username: string; displayName: string };

const BADGE: Record<string, string> = {
  instagram: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  youtube: 'bg-red-500/10 text-red-400 border-red-500/20',
  facebook: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export function ConnectedAccounts({ onChange }: { onChange?: () => void }) {
  const [profiles, setProfiles] = useState<SocialProfile[] | null>(null);
  const [oauth, setOauth] = useState<boolean | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState('');
    const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    clearJsonCache();
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
    fetch('/api/connect/instagram/config')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setOauth(data.oauth);
        if (!data.oauth) setShowToken(true);
      })
      .catch(() => !cancelled && setOauth(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = async (e: React.FormEvent, platform: 'instagram') => {
    e.preventDefault();
    setBusy(platform);
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, token }),
    });
    setBusy(null);
    if (res.ok) {
      const profile = await res.json();
      toast.success(`@${profile.username} connected`, { description: 'Press Sync on the Accounts page to pull in posts.' });
      setToken('');
      load();
    } else {
      const { error } = await res.json().catch(() => ({ error: '' }));
      toast.error('Could not connect', { description: error });
    }
  };

  const disconnect = async (profile: SocialProfile) => {
    if (!confirm(`Disconnect @${profile.username}? Its synced posts and metrics will be deleted.`)) return;
    const res = await fetch(`/api/accounts?id=${profile.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success(`@${profile.username} disconnected`);
      load();
    } else {
      toast.error('Failed to disconnect account');
    }
  };

  const instagram = profiles?.filter((p) => p.platform === 'instagram') ?? [];
  const youtube = profiles?.filter((p) => p.platform === 'youtube') ?? [];

  const row = (p: SocialProfile) => (
    <div key={p.id} className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <Badge className={`text-[10px] border capitalize ${BADGE[p.platform]}`}>{p.platform}</Badge>
        <span className="text-xs truncate">@{p.username}</span>
        {p.displayName && p.displayName !== p.username && <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">{p.displayName}</span>}
      </div>
      <Button variant="outline" size="sm" className="text-xs h-7 shrink-0" onClick={() => disconnect(p)}>Disconnect</Button>
    </div>
  );

  if (profiles === null) return <p className="text-xs text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-5">
      {/* Instagram */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold">Instagram</p>
          <span className="text-[10px] text-muted-foreground">{instagram.length} connected</span>
        </div>
        {instagram.map(row)}

        {oauth && (
          <Button asChild size="sm" className="text-xs h-8 gap-1.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-90 text-white border-0">
            <a href="/api/connect/instagram">
              {instagram.length ? <Plus className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
              {instagram.length ? 'Connect another Instagram account' : 'Connect with Instagram'}
            </a>
          </Button>
        )}
        {oauth && (
          <p className="text-[10px] text-muted-foreground">
            You&apos;ll log into Instagram and approve access. Accounts must be added as Instagram Testers in your Meta app first.
          </p>
        )}

        {oauth && !showToken && (
          <button type="button" onClick={() => setShowToken(true)} className="block text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2">
            Advanced: paste an access token instead
          </button>
        )}
        {showToken && (
          <form onSubmit={(e) => connect(e, 'instagram')} className="space-y-1.5">
            <div className="flex gap-2">
              <Input
                id="instagram-connect"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste an Instagram access token"
                className="h-8 text-xs bg-secondary/50 border-border"
                required
              />
              <Button type="submit" size="sm" disabled={busy !== null} className="text-xs h-8 shrink-0">
                {busy === 'instagram' ? 'Connecting...' : 'Add'}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Meta for Developers → your app → Instagram → API setup with Instagram login → Generate token.
            </p>
          </form>
        )}
      </section>

      {/* YouTube */}
      <section className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold">YouTube</p>
          <span className="text-[10px] text-muted-foreground">{youtube.length} connected</span>
        </div>
        {youtube.map(row)}
        <YouTubeConnect count={youtube.length} onAdded={load} />
      </section>
    </div>
  );
}
