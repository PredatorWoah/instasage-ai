'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Missing Credentials', { description: 'Please fill in both email and password fields.' });
      return;
    }
    
    // Simulate auth
    localStorage.setItem('instasage_session', JSON.stringify({ email, rememberMe, name: 'Creator User' }));
    toast.success('Welcome Back!', { description: 'Signed in successfully as Creator User.' });
    router.push('/');
  };

  const handleContinueAsDemo = () => {
    localStorage.setItem('instasage_session', JSON.stringify({ email: 'demo@instasage.ai', name: 'Demo Creator' }));
    toast.success('Welcome to InstaSage!', { description: 'Signed in as Demo Creator.' });
    router.push('/');
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background px-4">
      {/* Aurora blur glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-violet-600/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Brand logo */}
      <div className="flex items-center gap-2.5 mb-8 z-10">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight text-foreground">
          InstaSage<span className="text-indigo-400">.AI</span>
        </span>
      </div>

      {/* Card Form */}
      <div className="z-10 w-full max-w-sm bg-secondary/15 backdrop-blur-md rounded-2xl border border-border/80 shadow-2xl p-6 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold text-foreground tracking-tight">Welcome Back</h1>
          <p className="text-xs text-muted-foreground">Sign in to your creator operating dashboard</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          {/* Email input */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <Input
                id="email"
                type="email"
                placeholder="creator@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 h-9 bg-secondary/40 border-border text-xs focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground" htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium">
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 h-9 bg-secondary/40 border-border text-xs focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Remember me checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border bg-secondary/40 accent-indigo-600 cursor-pointer"
            />
            <label htmlFor="remember" className="text-[11px] text-muted-foreground cursor-pointer select-none">
              Remember Me
            </label>
          </div>

          {/* Buttons */}
          <div className="space-y-2 pt-2">
            <Button type="submit" className="w-full text-xs h-9 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white">
              Sign In
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleContinueAsDemo}
              className="w-full text-xs h-9 font-semibold border-border hover:bg-secondary/40"
            >
              Continue as Demo
            </Button>
          </div>
        </form>

        <div className="text-center text-xs text-muted-foreground border-t border-border/50 pt-4">
          New to InstaSage?{' '}
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
