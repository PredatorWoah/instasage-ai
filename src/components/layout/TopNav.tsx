'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Bell, Search, ChevronDown, User, Settings, LogOut, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PLATFORMS } from '@/constants/platforms';
import { MobileSidebar } from './MobileSidebar';
import { useSession, signOut } from 'next-auth/react';

function GlobalSearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') || '');

  useEffect(() => {
    setValue(searchParams.get('q') || '');
  }, [searchParams]);

  const onChange = (val: string) => {
    setValue(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set('q', val);
    } else {
      params.delete('q');
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="relative flex-1 max-w-sm hidden sm:block">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-pulse" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search posts, insights..."
        className="pl-9 h-9 bg-secondary/50 border-border text-sm"
      />
    </div>
  );
}

export function TopNav() {
  const { data: session } = useSession();
  const userName = session?.user?.name || session?.user?.email || 'Account';
  const initials = userName.substring(0, 2).toUpperCase();

  const handleLogout = () => {
    signOut({ callbackUrl: '/login' });
  };

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[240px] h-16 bg-background/80 backdrop-blur-md border-b border-border z-20 flex items-center px-6 gap-4">
      {/* Mobile menu trigger */}
      <MobileSidebar />

      {/* Global Search Input wrapped in Suspense for static pre-rendering safety */}
      <Suspense fallback={<div className="h-9 w-64 bg-secondary/20 rounded-md animate-pulse hidden sm:block" />}>
        <GlobalSearchInput />
      </Suspense>

      <div className="flex items-center gap-3 ml-auto">
        {/* Platform Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs h-8 border-border bg-secondary/50"
            >
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
              All Platforms
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {PLATFORMS.map((p) => (
              <DropdownMenuItem key={p.id} className="text-sm gap-2">
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
        </Button>

        {/* User Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full hover:opacity-85 transition-opacity">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-background border border-border p-1.5">
            <div className="px-2 py-1.5 mb-1">
              <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{session?.user?.email}</p>
            </div>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem asChild className="text-xs gap-2 py-2">
              <Link href="/">
                <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-xs gap-2 py-2">
              <Link href="/account">
                <User className="w-4 h-4 text-muted-foreground" />
                Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-xs gap-2 py-2">
              <Link href="/settings">
                <Settings className="w-4 h-4 text-muted-foreground" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-xs gap-2 py-2 text-rose-400 focus:text-rose-300 focus:bg-rose-500/10 cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
