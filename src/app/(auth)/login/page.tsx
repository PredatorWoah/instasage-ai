'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', { password, redirect: false });
    setLoading(false);
    if (res?.ok) {
      router.replace('/');
    } else if (!res?.error || res.error === 'CredentialsSignin') {
      setError('Wrong password.');
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 overflow-hidden">
      {/* Prism light */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(123,97,255,0.35),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-52 -right-40 w-[600px] h-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(255,95,143,0.22),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-40 w-[520px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(255,224,102,0.12),transparent)]" />

      <div className="relative w-full max-w-[400px] flex flex-col items-center gap-8 animate-rise">
        <div className="flex items-center gap-3">
          <span
            className="w-11 h-11 rounded-[14px] shadow-[0_0_36px_rgba(123,97,255,0.6)]"
            style={{ background: 'conic-gradient(from 180deg, #FF6B9A, #FF9F43, #FFE066, #4ADE9E, #4CC9F0, #7B61FF, #FF6B9A)' }}
          />
          <span className="font-display font-extrabold text-[30px] tracking-[-0.04em]">instasage</span>
        </div>

        <div className="w-full rounded-[32px] p-7 bg-card/80 backdrop-blur-xl border border-white/[0.07] shadow-[0_30px_80px_-30px_rgba(123,97,255,0.45)] flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-[36px] leading-none tracking-[-0.045em]">Welcome <span className="prism-text">back</span></h1>
            <p className="text-sm text-muted-foreground">Enter your password to open your dashboard.</p>
          </div>

          <form onSubmit={handleSignIn} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-12 text-base bg-background/60 border-white/[0.08] rounded-2xl"
                />
              </div>
              {error && <p className="text-xs text-rose-400">{error}</p>}
            </div>
            <Button type="submit" disabled={loading} className="h-12 text-sm font-bold prism-hero text-white border-0 shadow-[0_10px_30px_-10px_rgba(178,59,232,0.8)] hover:opacity-95 hover:scale-[1.01]">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
