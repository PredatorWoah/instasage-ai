'use client';

import { useState } from 'react';
import { CalendarRange, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MAX_DAYS, PERIOD_PRESETS, periodLabel, periodShort } from '@/lib/period';
import { setPeriod, usePeriod } from '@/lib/usePeriod';

// Time window for the whole app: Overview, Analytics, Content, Insights and every AI answer
export function PeriodPicker() {
  const { days, label } = usePeriod();
  const [custom, setCustom] = useState('');
  const customDays = Math.round(Number(custom));
  const customOk = Number.isFinite(customDays) && customDays >= 1 && customDays <= MAX_DAYS;
  const choose = (d: number | null) => {
    if (d !== days) setPeriod(d);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Time window: ${label}`}
          title="Time window for every page and AI answer"
          className="gap-1.5 text-[13px] h-11 w-11 sm:w-auto px-0 sm:px-3.5 rounded-full sm:rounded-md border-ink/[0.06] bg-card hover:bg-secondary"
        >
          <CalendarRange className="hidden sm:block w-4 h-4 text-muted-foreground" />
          <span className="font-bold tabular-nums text-[12px] sm:text-[13px]">{periodShort(days)}</span>
          <ChevronDown className="hidden sm:block w-3 h-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground font-bold uppercase tracking-wide">Time window</DropdownMenuLabel>
        {[...PERIOD_PRESETS, null].map((d) => (
          <DropdownMenuItem key={d ?? 'all'} onClick={() => choose(d)} className="text-sm gap-2">
            <span className="flex-1">{periodLabel(d)}</span>
            {d === days && <Check className="w-3.5 h-3.5" />}
          </DropdownMenuItem>
        ))}
        {days != null && !(PERIOD_PRESETS as readonly number[]).includes(days) && (
          <DropdownMenuItem className="text-sm gap-2" onClick={() => choose(days)}>
            <span className="flex-1">{periodLabel(days)}</span>
            <Check className="w-3.5 h-3.5" />
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <form
          className="flex items-center gap-1.5 px-2 py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (customOk) choose(customDays);
          }}
        >
          <label htmlFor="period-custom" className="text-xs text-muted-foreground shrink-0">Last</label>
          <input
            id="period-custom"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_DAYS}
            placeholder="45"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-16 h-8 rounded-md border border-border bg-background px-2 text-sm tabular-nums outline-none focus:border-indigo-400"
          />
          <span className="text-xs text-muted-foreground">days</span>
          <button type="submit" disabled={!customOk} className="ml-auto h-8 px-2.5 rounded-md bg-ink text-background text-xs font-bold disabled:opacity-40">Apply</button>
        </form>
        <p className="px-2 pb-1.5 text-[10.5px] leading-snug text-muted-foreground">Charts, posts and AI advice follow this window. Short windows get quick, tactical tips; long ones get strategy.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
