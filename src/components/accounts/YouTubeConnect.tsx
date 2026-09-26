'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, KeyRound, PlaySquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type KeyStatus = { source: 'saved' | 'env' | null; last4: string | null };

const link = (href: string, text: string) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">{text}</a>
);

const KEY_STEPS = [
  <>Open {link('https://console.cloud.google.com/projectcreate', 'Google Cloud')} and create a project (any name, e.g. &quot;InstaSage&quot;). Free, no card needed.</>,
  <>Open {link('https://console.cloud.google.com/apis/library/youtube.googleapis.com', 'YouTube Data API v3')} for that project and press <b>Enable</b>.</>,
  <>Go to {link('https://console.cloud.google.com/apis/credentials', 'Credentials')} → <b>Create credentials</b> → <b>API key</b>, and copy it (starts with <code>AIza</code>).</>,
  <>Optional but smart: <b>Edit API key</b> → API restrictions → <b>YouTube Data API v3</b> only.</>,
  <>Paste it below. The free quota (10,000 units a day) covers dozens of syncs.</>,
];

// Adding a channel: save a YouTube Data API key once, then add channels by @handle or URL
export function YouTubeConnect({ count, onAdded }: { count: number; onAdded: () => void }) {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [key, setKey] = useState('');
  const [channel, setChannel] = useState('');
  const [busy, setBusy] = useState<'key' | 'channel' | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    fetch('/api/settings/youtube').then((r) => (r.ok ? r.json() : null)).then((s: KeyStatus | null) => {
      setStatus(s);
      if (s && !s.source) setShowSteps(true);
    }).catch(() => {});
  }, []);

  const saveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('key');
    const res = await fetch('/api/settings/youtube', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error('Key not saved', { description: data.error });
    setStatus(data);
    setKey('');
    setShowSteps(false);
    toast.success('YouTube key works', { description: 'Now add your channel.' });
  };

  const addChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('channel');
    const res = await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'youtube', channel }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(null);
      return toast.error('Could not add the channel', { description: data.error });
    }
    toast.success(`${data.displayName} added`, { description: 'Pulling in your latest videos...' });
    setChannel('');
    const sync = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: data.id }) });
    setBusy(null);
    if (sync.ok) toast.success('Videos synced', { description: 'Pick the channel in the top right switcher to see YouTube stats.' });
    else toast.error('Sync failed', { description: (await sync.json().catch(() => ({}))).error });
    onAdded();
  };

  const hasKey = !!status?.source;

  return (
    <div className="space-y-3">
      {hasKey ? (
        <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {status?.source === 'saved' ? `API key ••••${status.last4}` : 'Using YOUTUBE_API_KEY from hosting'}
          </span>
          <button type="button" onClick={() => setStatus({ source: null, last4: null })} className="underline underline-offset-2 hover:text-foreground">Change key</button>
        </div>
      ) : (
        <form onSubmit={saveKey} className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">Step 1: a free YouTube Data API key (one time).</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza..." className="pl-8 h-8 text-xs bg-secondary/50 border-border" required />
            </div>
            <Button type="submit" size="sm" disabled={busy !== null} className="text-xs h-8 shrink-0">{busy === 'key' ? 'Testing...' : 'Save key'}</Button>
          </div>
        </form>
      )}

      <form onSubmit={addChannel} className="space-y-1.5">
        {!hasKey && <p className="text-[11px] text-muted-foreground">Step 2: your channel.</p>}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <PlaySquare className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-red-400" />
            <Input
              id="youtube-connect"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="@yourchannel or youtube.com/@yourchannel"
              className="pl-8 h-8 text-xs bg-secondary/50 border-border"
              disabled={!hasKey}
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={!hasKey || busy !== null} className="text-xs h-8 shrink-0 bg-red-600 hover:bg-red-700 text-white">
            {busy === 'channel' ? 'Adding...' : count ? 'Add another' : 'Add channel'}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Find the handle under the channel name on YouTube. Once added, pick the channel in the top right switcher and every page switches to YouTube mode: subscribers, Shorts vs long videos, titles.
        </p>
      </form>

      <div className="rounded-lg border border-border bg-secondary/10">
        <button type="button" onClick={() => setShowSteps((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium" aria-expanded={showSteps}>
          How to get a YouTube API key
          <span className="text-muted-foreground">{showSteps ? 'Hide' : 'Show'}</span>
        </button>
        {showSteps && (
          <div className="px-3 pb-3 space-y-2">
            <ol className="list-decimal pl-4 space-y-1.5 text-xs text-muted-foreground leading-relaxed [&_code]:text-[10px] [&_code]:px-1 [&_code]:rounded [&_code]:bg-secondary">
              {KEY_STEPS.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
              What you get: subscribers, views, likes and comments for every video, Shorts vs long-form, and daily subscriber and channel view history. Watch time, retention and viewer demographics are private to YouTube Studio and need a Google sign-in, so they are not included.
            </p>
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline">
              Open Google Cloud credentials <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
