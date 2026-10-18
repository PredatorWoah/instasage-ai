'use client';

import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { Bell, BellOff, Download, Send, Smartphone, Trash2 } from 'lucide-react';
import { useCachedJson } from '@/lib/useCachedJson';
import { formatRelativeTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';

type PushInfo = {
  publicKey: string;
  prefs: { digest: boolean; alerts: boolean };
  devices: { id: string; endpoint: string; device: string | null; createdAt: string; lastUsedAt: string | null }[];
};

const URL_ = '/api/push';

// The browser wants the key as raw bytes
function keyBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Support = 'ok' | 'ios-install' | 'unsupported' | 'loading';
const noop = () => () => {};
function supportNow(): Support {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return 'ios-install';
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'ok' : 'unsupported';
}

// Endpoint of this browser's current subscription, read once the service worker is ready
let endpointCache: string | null | undefined;
const endpointListeners = new Set<() => void>();
function loadEndpoint() {
  if (endpointCache !== undefined || !('serviceWorker' in navigator)) return;
  endpointCache = null;
  navigator.serviceWorker.getRegistration().then((reg) => reg?.pushManager.getSubscription()).then((sub) => {
    endpointCache = sub?.endpoint ?? null;
    endpointListeners.forEach((l) => l());
  }).catch(() => {});
}
function setEndpoint(v: string | null) {
  endpointCache = v;
  endpointListeners.forEach((l) => l());
}

export function NotificationSettings() {
  const { data, refresh } = useCachedJson<PushInfo>(URL_);
  const support = useSyncExternalStore(noop, supportNow, () => 'loading' as Support);
  const endpoint = useSyncExternalStore(
    (cb) => {
      endpointListeners.add(cb);
      loadEndpoint();
      return () => endpointListeners.delete(cb);
    },
    () => endpointCache ?? null,
    () => null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  // Ticks flip at once; the saved value takes over when the refetch lands
  const [pending, setPending] = useState<Partial<PushInfo['prefs']>>({});

  const here = data?.devices.find((d) => d.endpoint === endpoint);

  const enable = async () => {
    if (!data) return;
    setBusy('enable');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Notifications are blocked', { description: 'Allow them for this site in your browser settings, then try again.' });
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.publicKey) }));
      const res = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save this device.');
      setEndpoint(sub.endpoint);
      await refresh();
      toast.success('Notifications are on for this device');
    } catch (error) {
      const refused = (error as Error).name === 'AbortError' || (error as Error).name === 'NotAllowedError';
      toast.error('Could not turn on notifications', {
        description: refused ? 'The browser refused. Private windows and some browsers block push; try a normal Chrome, Edge, Firefox or Safari window.' : (error as Error).message,
      });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string, isHere: boolean) => {
    setBusy(id);
    if (isHere) {
      const reg = await navigator.serviceWorker.getRegistration();
      await (await reg?.pushManager.getSubscription())?.unsubscribe().catch(() => {});
      setEndpoint(null);
    }
    await fetch(`${URL_}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await refresh();
    setBusy(null);
  };

  const setPref = async (key: 'digest' | 'alerts', value: boolean) => {
    setPending((p) => ({ ...p, [key]: value }));
    const res = await fetch(URL_, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefs: { [key]: value } }) }).catch(() => null);
    if (!res?.ok) toast.error('Could not save that');
    await refresh();
    setPending((p) => {
      const rest = { ...p };
      delete rest[key];
      return rest;
    });
  };

  const test = async () => {
    setBusy('test');
    const res = await fetch('/api/push/test', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) toast.success(`Sent to ${body.sent} of ${body.devices} device${body.devices === 1 ? '' : 's'}`, { description: body.failed ? 'Some devices did not accept it and may need turning on again.' : 'It should pop up in a few seconds.' });
    else toast.error(body.error || 'Could not send');
    setBusy(null);
  };

  if (!data) return <div className="h-24 rounded-2xl bg-ink/[0.04] animate-pulse" />;

  return (
    <div className="space-y-4">
      {support === 'ios-install' && (
        <p className="text-[13px] text-amber-400 bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2.5 flex gap-2">
          <Download className="w-4 h-4 shrink-0 mt-0.5" />
          <span>On iPhone, notifications work once InstaSage is on your home screen: tap Share, then <b>Add to Home Screen</b>, open it from there and come back here.</span>
        </p>
      )}
      {support === 'unsupported' && <p className="text-[13px] text-muted-foreground">This browser can&apos;t receive web notifications. Chrome, Edge, Firefox and Safari can.</p>}

      {support === 'ok' && (
        <div className="flex flex-wrap items-center gap-2">
          {here ? (
            <span className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] font-bold"><Bell className="w-4 h-4" /> On for this device</span>
          ) : (
            <button type="button" onClick={enable} disabled={!!busy} className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-ink text-background text-[13px] font-bold disabled:opacity-60">
              <Bell className="w-4 h-4" /> {busy === 'enable' ? 'Turning on...' : 'Turn on for this device'}
            </button>
          )}
          {data.devices.length > 0 && (
            <button type="button" onClick={test} disabled={!!busy} className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-ink/[0.07] border border-ink/[0.1] text-[13px] font-bold hover:bg-ink/[0.12] disabled:opacity-60">
              <Send className="w-4 h-4" /> {busy === 'test' ? 'Sending...' : 'Send a test'}
            </button>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2">
        {([
          { key: 'alerts', title: 'Alerts', blurb: 'A post taking off, a long gap since your last post, milestones, a follower drop, a rival going viral' },
          { key: 'digest', title: 'Morning digest', blurb: 'Follower change since yesterday and your best post this week, after the daily sync' },
        ] as const).map((o) => (
          <label key={o.key} className={cn('flex items-start gap-3 p-3 rounded-2xl border cursor-pointer', (pending[o.key] ?? data.prefs[o.key]) ? 'bg-ink/[0.05] border-ink/[0.12]' : 'bg-ink/[0.02] border-ink/[0.06]')}>
            <input type="checkbox" checked={pending[o.key] ?? data.prefs[o.key]} onChange={(e) => setPref(o.key, e.target.checked)} className="mt-1 accent-[#8E78FF]" />
            <span>
              <span className="block text-sm font-bold">{o.title}</span>
              <span className="block text-[12px] text-muted-foreground leading-snug">{o.blurb}</span>
            </span>
          </label>
        ))}
      </div>

      {data.devices.length > 0 ? (
        <ul className="space-y-1.5">
          {data.devices.map((d) => {
            const isHere = d.endpoint === endpoint;
            return (
              <li key={d.id} className="flex items-center gap-3 text-[13px]">
                <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 min-w-0 truncate">{d.device ?? 'A browser'}{isHere && <span className="text-muted-foreground"> · this device</span>}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{d.lastUsedAt ? `last sent ${formatRelativeTime(d.lastUsedAt).toLowerCase()}` : `added ${formatRelativeTime(d.createdAt).toLowerCase()}`}</span>
                <button type="button" onClick={() => remove(d.id, isHere)} disabled={busy === d.id} aria-label={`Turn off notifications for ${d.device ?? 'this browser'}`} className="p-1.5 rounded-full text-muted-foreground hover:text-rose-400 hover:bg-ink/[0.06]">
                  {isHere ? <BellOff className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[12px] text-muted-foreground">No devices yet. Turn it on here, and on your phone too if you like.</p>
      )}
    </div>
  );
}
