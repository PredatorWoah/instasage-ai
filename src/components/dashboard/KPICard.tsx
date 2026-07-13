'use client';

import { TrendingUp, TrendingDown, Minus, Users, Radio, Eye, Clock, Heart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { KPIMetric } from '@/types';

const ICON_MAP: Record<string, React.ElementType> = {
  Users, Radio, Eye, Clock, Heart, TrendingUp,
};

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-400',
  violet: 'bg-violet-500/10 text-violet-400',
  blue: 'bg-blue-500/10 text-blue-400',
  cyan: 'bg-cyan-500/10 text-cyan-400',
  rose: 'bg-rose-500/10 text-rose-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
};

type KPICardProps = {
  metric: KPIMetric;
};

export function KPICard({ metric }: KPICardProps) {
  const Icon = ICON_MAP[metric.icon] ?? Users;
  const iconClass = COLOR_MAP[metric.color] ?? 'bg-slate-500/10 text-slate-400';

  return (
    <Card className="bg-secondary/20 border-border hover:border-border/80 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('p-2 rounded-lg', iconClass)}>
            <Icon className="w-4 h-4" />
          </div>
          <TrendIndicator trend={metric.trend} changePercent={metric.changePercent} />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight text-foreground">{metric.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
          <span className={metric.trend === 'up' ? 'text-emerald-400' : metric.trend === 'down' ? 'text-red-400' : 'text-muted-foreground'}>
            {metric.change}
          </span>{' '}
          vs last month
        </p>
      </CardContent>
    </Card>
  );
}

function TrendIndicator({ trend, changePercent }: { trend: string; changePercent: number }) {
  if (trend === 'up') {
    return (
      <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
        <TrendingUp className="w-3 h-3" />
        <span className="text-[11px] font-semibold">+{changePercent}%</span>
      </div>
    );
  }
  if (trend === 'down') {
    return (
      <div className="flex items-center gap-1 text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
        <TrendingDown className="w-3 h-3" />
        <span className="text-[11px] font-semibold">-{changePercent}%</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
      <Minus className="w-3 h-3" />
      <span className="text-[11px] font-semibold">{changePercent}%</span>
    </div>
  );
}
