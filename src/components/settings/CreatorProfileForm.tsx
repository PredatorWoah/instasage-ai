'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { clearJsonCache } from '@/lib/useCachedJson';

type Profile = { niche: string; audience: string; goals: string; postsPerWeek: string; voice: string; avoid: string; language: string };
const EMPTY: Profile = { niche: '', audience: '', goals: '', postsPerWeek: '', voice: '', avoid: '', language: '' };

const FIELDS: { key: keyof Profile; label: string; placeholder: string; long?: boolean }[] = [
  { key: 'niche', label: 'Niche', placeholder: 'Aesthetic skin clinic in Mumbai: acne, pigmentation, glow treatments' },
  { key: 'audience', label: 'Who you want to reach', placeholder: 'Women 22 to 35 in India who care about skincare but are tired of myths' },
  { key: 'goals', label: 'Goals', placeholder: 'More consultation DMs, 1,000 followers by March, be the trusted voice on acne', long: true },
  { key: 'voice', label: 'Your voice', placeholder: 'Warm, expert but simple, a bit witty, never preachy', long: true },
  { key: 'avoid', label: 'Topics or styles to avoid', placeholder: 'No before and after of minors, no fear-based claims, no dancing trends' },
  { key: 'language', label: 'Language for captions and scripts', placeholder: 'English with a little Hinglish' },
];

// Everything the AI should know about you that your numbers can't tell it
export function CreatorProfileForm() {
  const [form, setForm] = useState<Profile>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/user').then((r) => (r.ok ? r.json() : null)).then((u) => {
      const p = u?.creatorProfile ?? {};
      setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) });
    }).catch(() => {});
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/user', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creatorProfile: form }) });
    setSaving(false);
    if (!res.ok) return toast.error('Profile not saved');
    clearJsonCache();
    toast.success('Creator profile saved', { description: 'Every plan, idea and script now takes it into account. Regenerate the Game plan to see it.' });
  };

  const set = (key: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <form onSubmit={save} className="rounded-[30px] bg-card border border-ink/[0.05] p-5 sm:p-6 space-y-4" id="creator-profile">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-400" /> Creator profile</h2>
        <p className="text-[13px] text-muted-foreground mt-1">The AI reads this before every plan, idea, script and reply. The more specific, the less generic the advice.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.long ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
            <Label htmlFor={`cp-${f.key}`} className="text-xs">{f.label}</Label>
            {f.long ? (
              <textarea id={`cp-${f.key}`} rows={2} value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder} className="w-full rounded-md border border-border bg-secondary/50 p-2.5 text-sm focus:outline-none focus:border-indigo-500 leading-relaxed" />
            ) : (
              <Input id={`cp-${f.key}`} value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder} className="h-9 text-sm bg-secondary/50 border-border" />
            )}
          </div>
        ))}
        <div className="space-y-1.5">
          <Label htmlFor="cp-postsPerWeek" className="text-xs">Posts you can realistically make per week</Label>
          <Input id="cp-postsPerWeek" type="number" min={1} max={50} value={form.postsPerWeek} onChange={set('postsPerWeek')} placeholder="3" className="h-9 text-sm bg-secondary/50 border-border" />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={saving} className="text-xs h-9 bg-indigo-600 hover:bg-indigo-700">{saving ? 'Saving...' : 'Save creator profile'}</Button>
    </form>
  );
}
