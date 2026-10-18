'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeChoice } from '@/lib/theme';
import { cn } from '@/lib/utils';

const OPTIONS: { id: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'system', label: 'Match device', icon: Monitor },
];

export function ThemePicker() {
  const { choice, setChoice } = useTheme();
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Theme">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={choice === o.id}
          onClick={() => setChoice(o.id)}
          className={cn('inline-flex items-center gap-2 h-10 px-4 rounded-full border text-[13px] font-bold transition-colors', choice === o.id ? 'bg-ink text-background border-ink' : 'bg-ink/[0.04] border-ink/[0.08] hover:bg-ink/[0.08]')}
        >
          <o.icon className="w-4 h-4" /> {o.label}
        </button>
      ))}
    </div>
  );
}
