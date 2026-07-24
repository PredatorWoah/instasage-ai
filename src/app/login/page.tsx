'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Sparkles, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();

  const handleSignInGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch (error) {
      toast.error('Authentication failed');
    }
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

        <form onSubmit={handleSignInGoogle} className="space-y-4">
          <div className="space-y-2 pt-2">
            <Button type="submit" className="w-full text-xs h-9 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white">
              Sign In with Google
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
