'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Sparkles, LayoutDashboard, BarChart3, Grid2X2, Lightbulb, Users, Swords, FileText, Settings, UserCheck } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { NAV_ITEMS } from '@/constants/navigation';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, BarChart3, Grid2X2, Sparkles,
  Lightbulb, Users, Swords, FileText, Settings, UserCheck,
};

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8">
          <Menu className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[240px] p-0 bg-background border-border">
        <div className="flex items-center gap-2.5 px-6 h-16 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight">
            InstaSage<span className="text-indigo-400">.AI</span>
          </span>
        </div>
        <nav className="py-4 px-3">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = ICON_MAP[item.iconName];
              const isActive = pathname === item.href;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
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
      </SheetContent>
    </Sheet>
  );
}
