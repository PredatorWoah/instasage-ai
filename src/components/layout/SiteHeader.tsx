'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NAV_TABS, MENU_LINKS, activeTabIndex } from '@/constants/navigation';
import { AccountSwitcher } from './AccountSwitcher';
import { MobileNav } from './MobileNav';
import { clearJsonCache, prefetchJson } from '@/lib/useCachedJson';

// Data each tab needs, fetched as soon as a finger or pointer lands on the tab
const TAB_DATA: Record<string, string[]> = {
  analytics: ['/api/analytics?days=30'],
  content: ['/api/posts'],
  insights: ['/api/ai/insights'],
  recommendations: ['/api/ai/plan', '/api/ideas/threads'],
  audience: ['/api/audience', '/api/posts'],
};
const warm = (id: string) => TAB_DATA[id]?.forEach(prefetchJson);
import { cn } from '@/lib/utils';

// Tabs to the right slide in from the right, tabs to the left from the left
function directionTo(target: number, current: number) {
  if (current < 0) return ['page-fade'];
  return target > current ? ['nav-forward'] : ['nav-back'];
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  // Phones have no hover, so preload every tab (page + data) once the app is idle
  useEffect(() => {
    // Share the device timezone so AI advice, reports and the daily refresh use local times
    // (the server ignores it when a timezone was picked by hand in Settings)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.cookie = `tz=${tz}; path=/; max-age=31536000; samesite=lax`;
    fetch('/api/user/timezone', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ detected: tz }) })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.changed && clearJsonCache())
      .catch(() => {});
    NAV_TABS.forEach((tab) => router.prefetch(tab.href));
    const warmAll = () => Object.keys(TAB_DATA).forEach(warm);
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    const handle = idle(warmAll);
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(handle as number);
  }, [router]);
  const current = activeTabIndex(pathname);
  const name = session?.user?.name || 'Owner';

  return (
    <header
      style={{ viewTransitionName: 'site-header' }}
      className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/[0.04]"
    >
      <div className="max-w-[1480px] mx-auto px-3 sm:px-6 h-[72px] flex items-center gap-2.5 sm:gap-6">
        <Link href="/" transitionTypes={directionTo(0, current)} className="flex items-center gap-2.5 shrink-0" aria-label="InstaSage home">
          <span className="w-9 h-9 rounded-[12px] shadow-[0_0_24px_rgba(123,97,255,0.45)]" style={{ background: 'conic-gradient(from 180deg, #FF6B9A, #FF9F43, #FFE066, #4ADE9E, #4CC9F0, #7B61FF, #FF6B9A)' }} />
          <span className="font-display font-extrabold text-[22px] tracking-[-0.03em] hidden xl:inline">instasage</span>
        </Link>

        {/* Phones: glass menu pill */}
        <div className="md:hidden min-w-0 flex-1">
          <MobileNav onWarm={warm} />
        </div>

        {/* Tablets and up: the pill tab bar */}
        <nav aria-label="Main" className="hidden md:flex min-w-0 flex-1 justify-center">
          <div className="flex gap-1 p-1.5 rounded-full bg-card border border-white/[0.04] overflow-x-auto no-scrollbar max-w-full">
            {NAV_TABS.map((tab, i) => {
              const active = i === current;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  transitionTypes={directionTo(i, current)}
                  prefetch
                  onPointerEnter={() => warm(tab.id)}
                  onTouchStart={() => warm(tab.id)}
                  onFocus={() => warm(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative shrink-0 px-4 py-2 rounded-full text-sm transition-colors duration-300',
                    active ? 'text-background font-bold' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      style={{ viewTransitionName: 'nav-pill' }}
                      className="absolute inset-0 rounded-full bg-white shadow-[0_4px_24px_rgba(255,255,255,0.18)]"
                    />
                  )}
                  <span className="relative">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <AccountSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="w-11 h-11 rounded-full prism-hero flex items-center justify-center font-display font-extrabold text-sm text-white shadow-[0_0_20px_rgba(178,59,232,0.35)] hover:scale-105 transition-transform"
              >
                {name.substring(0, 2).toUpperCase()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
              <div className="px-2.5 py-2">
                <p className="text-sm font-semibold truncate">{name}</p>
                <p className="text-[11px] text-muted-foreground">Signed in</p>
              </div>
              <DropdownMenuSeparator />
              {MENU_LINKS.map((item) => (
                <DropdownMenuItem key={item.id} asChild className="rounded-xl text-sm py-2">
                  <Link href={item.href} transitionTypes={['page-fade']}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="rounded-xl text-sm py-2 gap-2 text-rose-400 focus:text-rose-300"
              >
                <LogOut className="w-4 h-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
