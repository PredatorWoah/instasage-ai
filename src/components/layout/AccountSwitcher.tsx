'use client';

import { ACCOUNT_COOKIE, usePlatform } from '@/lib/usePlatform';
import Link from 'next/link';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const DOT: Record<string, string> = { instagram: '#ec4899', youtube: '#ef4444', facebook: '#3b82f6' };

export function AccountSwitcher() {
  const { profiles, selected, current } = usePlatform();

  const choose = (id: string) => {
    if (id === selected) return;
    document.cookie = `${ACCOUNT_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    // Every page, chart and AI result reads the selection, so reload to refetch everything
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-[13px] h-11 px-4 border-white/[0.06] bg-card hover:bg-secondary max-w-[132px] sm:max-w-[220px]">
          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: current ? DOT[current.platform] : '#6366f1' }} />
          <span className="truncate">{current ? `@${current.username}` : 'All accounts'}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={() => choose('all')} className="text-sm gap-2">
          <span className="w-2 h-2 rounded-full inline-block shrink-0 bg-indigo-500" />
          <span className="flex-1">All accounts</span>
          {selected === 'all' && <Check className="w-3.5 h-3.5" />}
        </DropdownMenuItem>
        {profiles.length > 0 && <DropdownMenuSeparator />}
        {profiles.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => choose(p.id)} className="text-sm gap-2">
            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: DOT[p.platform] ?? '#64748b' }} />
            <span className="flex-1 min-w-0">
              <span className="block truncate">@{p.username}</span>
              <span className="block text-[10px] text-muted-foreground capitalize">{p.platform}</span>
            </span>
            {selected === p.id && <Check className="w-3.5 h-3.5 shrink-0" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="text-xs gap-2 text-muted-foreground">
          <Link href="/accounts"><Plus className="w-3.5 h-3.5" /> Add an account</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
