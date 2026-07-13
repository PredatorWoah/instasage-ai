'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Email Required', { description: 'Please enter your email to request a reset link.' });
      return;
    }

    toast.success('Reset Link Sent', {
      description: `A password reset link has been dispatched to ${email}.`,
    });
    router.push('/login');
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
          <h1 className="text-lg font-bold text-foreground tracking-tight">Reset Password</h1>
          <p className="text-xs text-muted-foreground">Enter your email and we'll transmit a password recovery link</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
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

          {/* Button */}
          <Button type="submit" className="w-full text-xs h-9 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white">
            Send Reset Link
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground border-t border-border/50 pt-4">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
