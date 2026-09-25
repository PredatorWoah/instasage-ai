'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard, BarChart3, Grid2X2, Sparkles, Lightbulb,
  Users, Swords, FileText, Settings, UserCheck,
} from 'lucide-react';
import { NAV_ITEMS } from '@/constants/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, BarChart3, Grid2X2, Sparkles,
  Lightbulb, Users, Swords, FileText, Settings, UserCheck,
};

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const displayName = session?.user?.name || 'Owner';

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-[240px] bg-background border-r border-border z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 h-16 border-b border-border shrink-0">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-bold tracking-tight text-foreground">
          InstaSage<span className="text-indigo-400">.AI</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-2">
          Main Menu
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.slice(0, 8).map((item) => {
            const Icon = ICON_MAP[item.iconName];
            const isActive = pathname === item.href;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-400'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  )}
                >
                  {Icon && <Icon className="w-4 h-4 shrink-0" />}
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-2 mt-6">
          Account
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.slice(8).map((item) => {
            const Icon = ICON_MAP[item.iconName];
            const isActive = pathname === item.href;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-400'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  )}
                >
                  {Icon && <Icon className="w-4 h-4 shrink-0" />}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Profile Footer */}
      <div className="px-4 py-4 border-t border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">
            {displayName[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">Signed in</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
