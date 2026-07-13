'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, User, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      toast.error('Registration Error', { description: 'Please fill in all fields.' });
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Password Mismatch', { description: 'Confirm password must match the password.' });
      return;
    }

    // Simulate account registration
    localStorage.setItem(
      'instasage_session',
      JSON.stringify({ email, name, avatarName: name.substring(0, 2).toUpperCase() })
    );
    toast.success('Registration Complete', { description: `Welcome ${name}! Account created successfully.` });
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
          <h1 className="text-lg font-bold text-foreground tracking-tight">Create Account</h1>
          <p className="text-xs text-muted-foreground">Register to unlock your creator performance workspace</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Name input */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="name">Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <Input
                id="name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-9 h-9 bg-secondary/40 border-border text-xs focus:border-indigo-500"
              />
            </div>
          </div>

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
            <Label className="text-xs text-muted-foreground" htmlFor="password">Password</Label>
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

          {/* Confirm Password input */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="confirm">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-9 h-9 bg-secondary/40 border-border text-xs focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Button */}
          <Button type="submit" className="w-full text-xs h-9 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white pt-2">
            Create Account
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground border-t border-border/50 pt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
