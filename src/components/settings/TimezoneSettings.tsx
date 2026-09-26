'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Globe2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { clearJsonCache } from '@/lib/useCachedJson';

type State = { timeZone: string | null; auto: boolean };

const zoneLabel = (tz: string) => {
  try {
    const offset = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value;
    return `${tz.replace(/_/g, ' ')} (${offset})`;
  } catch {
    return tz;
  }
};

// Which timezone posting times, reports and the AI talk in
export function TimezoneSettings() {
  const detected = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return [detected];
    }
  }, [detected]);
  const [state, setState] = useState<State | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/user/timezone').then((r) => (r.ok ? r.json() : null)).then(setState).catch(() => {});
  }, []);

  const save = async (timeZone: string, auto: boolean) => {
    setSaving(true);
    const res = await fetch('/api/user/timezone', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeZone, auto }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return toast.error('Timezone not saved', { description: data.error });
    setState({ timeZone, auto });
    if (data.changed) {
      clearJsonCache();
      toast.success('Timezone saved', { description: `Times now show in ${zoneLabel(timeZone)}. Old AI answers were cleared so they regenerate in local time.` });
    }
  };

  if (!state) return <div className="h-24 rounded-xl bg-secondary/10 animate-pulse" />;
  const zone = state.timeZone ?? detected;
  const now = new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.07] bg-white/[0.02]">
        <Globe2 className="w-5 h-5 text-indigo-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{zoneLabel(zone)}</p>
          <p className="text-[11px] text-muted-foreground">It is {now} there. Best times, reports and every AI answer use this zone.</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Follow this device</p>
          <p className="text-xs text-muted-foreground">Detected here: {zoneLabel(detected)}</p>
        </div>
        <Switch checked={state.auto} disabled={saving} onCheckedChange={(auto) => save(auto ? detected : zone, auto)} />
      </div>

      {!state.auto && (
        <select
          value={zone}
          disabled={saving}
          onChange={(e) => save(e.target.value, false)}
          className="w-full h-9 rounded-md border border-border bg-secondary/50 px-2.5 text-xs"
          aria-label="Timezone"
        >
          {(zones.includes(zone) ? zones : [zone, ...zones]).map((tz) => <option key={tz} value={tz}>{zoneLabel(tz)}</option>)}
        </select>
      )}
    </div>
  );
}
