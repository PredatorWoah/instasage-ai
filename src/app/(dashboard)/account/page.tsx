'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

type Profile = { name: string; username: string; bio: string };

export default function AccountPage() {
  const { update: updateSession } = useSession();
  const [form, setForm] = useState<Profile>({ name: '', username: '', bio: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/user')
      .then((res) => (res.ok ? res.json() : null))
      .then((user) => user && setForm({ name: user.name || '', username: user.username || '', bio: user.bio || '' }))
      .catch(() => toast.error('Failed to load profile'));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/user', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) return toast.error('Failed to save profile');
    const user = await res.json();
    setForm({ name: user.name || '', username: user.username || '', bio: user.bio || '' });
    await updateSession({ name: user.name });
    toast.success('Profile saved');
  };

  const field = (key: keyof Profile) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value })) });

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-4">
        <span className="w-16 h-16 rounded-[22px] prism-hero flex items-center justify-center text-white font-display font-extrabold text-2xl shrink-0">
          {(form.name || '?').slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">{form.name || 'Your profile'}</h1>
          {form.username && <p className="text-sm text-muted-foreground mt-1">@{form.username}</p>}
        </div>
      </div>

      <form onSubmit={save} className="rounded-[30px] bg-card border border-white/[0.05] p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold">Profile</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">Name</Label>
            <Input id="name" {...field('name')} className="h-9 text-sm bg-secondary/50 border-border" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs">Username</Label>
            <Input id="username" {...field('username')} className="h-9 text-sm bg-secondary/50 border-border" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bio" className="text-xs">Bio (the AI reads it to understand your niche)</Label>
            <textarea id="bio" rows={3} {...field('bio')} className="w-full rounded-md border border-border bg-secondary/50 p-2.5 text-sm focus:outline-none focus:border-indigo-500 leading-relaxed" />
          </div>
        </div>
        <Button type="submit" size="sm" disabled={saving} className="text-xs h-9 bg-indigo-600 hover:bg-indigo-700">{saving ? 'Saving...' : 'Save changes'}</Button>
      </form>

      <section className="rounded-[30px] bg-card border border-white/[0.05] p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold">Security</h2>
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
          <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
          <p className="text-[13px] text-muted-foreground">Password protected. To change the password, update <code className="text-[11px] px-1 rounded bg-secondary">APP_PASSWORD</code> in Vercel and redeploy.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/login' })} className="text-xs h-9 gap-1.5">
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </Button>
      </section>
    </div>
  );
}
