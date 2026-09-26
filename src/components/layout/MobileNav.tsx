'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3, ChevronDown, FileText, Grid2X2, LayoutDashboard, Lightbulb, Settings, Sparkles, Swords, UserCheck, UserRound, Users,
} from 'lucide-react';
import { NAV_TABS, MENU_LINKS, activeTabIndex } from '@/constants/navigation';
import { cn } from '@/lib/utils';

const TAB_ICONS: Record<string, React.ElementType> = {
  overview: LayoutDashboard,
  analytics: BarChart3,
  content: Grid2X2,
  insights: Sparkles,
  recommendations: Lightbulb,
  audience: Users,
};
const MENU_ICONS: Record<string, React.ElementType> = {
  accounts: UserCheck,
  reports: FileText,
  competitors: Swords,
  account: UserRound,
  settings: Settings,
};

// Phones: one glass pill naming the current page; tapping it drops a frosted panel of every page
export function MobileNav({ onWarm }: { onWarm: (id: string) => void }) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so moving to another page closes it
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean | ((v: boolean) => boolean)) =>
    setOpenOn((prev) => ((typeof next === 'function' ? next(prev === pathname) : next) ? pathname : null));
  const current = activeTabIndex(pathname);
  const currentLabel =
    current >= 0 ? NAV_TABS[current].label : MENU_LINKS.find((m) => pathname.startsWith(m.href))?.label ?? 'Menu';

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenOn(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const direction = (target: number) => (current < 0 ? ['page-fade'] : target > current ? ['nav-forward'] : ['nav-back']);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          NAV_TABS.forEach((t) => onWarm(t.id));
        }}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className={cn(
          'flex items-center gap-2 h-11 pl-4 pr-3 rounded-full border text-sm font-bold transition-all duration-300 active:scale-[0.97]',
          'bg-white/[0.07] border-white/[0.12] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
          open && 'bg-white text-background border-white'
        )}
      >
        <span className="truncate max-w-[120px]">{currentLabel}</span>
        <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform duration-300', open && 'rotate-180')} />
      </button>

      {/* Rendered at the page root: inside the header (which has its own backdrop blur) the
          panel's frosted glass could only see the header, so the page showed through unblurred */}
      {open && createPortal(
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[72px] z-40 bg-black/40 backdrop-blur-[6px] animate-[fade-in_200ms_ease-out_both]"
          />
          <div
            id="mobile-nav-panel"
            className="acrylic-panel fixed left-3 right-3 top-[80px] z-50 rounded-[30px] p-3 origin-top animate-[drop-in_320ms_cubic-bezier(0.22,1,0.36,1)_both]"
          >
            <nav aria-label="Pages" className="grid grid-cols-2 gap-2 stagger">
              {NAV_TABS.map((tab, i) => {
                const Icon = TAB_ICONS[tab.id];
                const active = i === current;
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    transitionTypes={direction(i)}
                    onTouchStart={() => onWarm(tab.id)}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 h-16 px-4 rounded-[22px] text-[15px] font-semibold transition-colors active:scale-[0.97]',
                      active
                        ? 'bg-white text-background shadow-[0_8px_30px_rgba(255,255,255,0.18)]'
                        : 'bg-white/[0.06] text-foreground border border-white/[0.07]'
                    )}
                  >
                    <span className={cn('w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0', active ? 'prism-hero text-white' : 'bg-white/[0.08]')}>
                      <Icon className="w-[18px] h-[18px]" />
                    </span>
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-3 pt-3 border-t border-white/[0.08] flex flex-wrap gap-2">
              {MENU_LINKS.map((item) => {
                const Icon = MENU_ICONS[item.id];
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    transitionTypes={['page-fade']}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-1.5 h-10 px-3.5 rounded-full text-[13px] font-medium border transition-colors',
                      active ? 'bg-white text-background border-white' : 'bg-white/[0.05] border-white/[0.08] text-muted-foreground'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" /> {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
