'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatDate, formatNumber } from '@/utils/formatters';
import type { TimeSeriesPoint } from '@/types';

type FollowersChartProps = {
  data: TimeSeriesPoint[];
  label?: string;
};

// Fit the axis to the counts themselves: from zero, 14.6K to 14.7K would look like a flat line
function domainFor(data: TimeSeriesPoint[]): [number, number] | undefined {
  const values = data.map((d) => d.followers).filter((v): v is number => v != null);
  if (!values.length) return undefined;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.2, max * 0.002, 2);
  return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
}

export function FollowersChart({ data, label = 'Followers' }: FollowersChartProps) {
  const domain = domainFor(data);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="followersGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FF7A8A" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#FF7A8A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,160,0.15)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 10, fill: '#8A8A9C' }}
          tickLine={false}
          axisLine={false}
          interval={data.length > 90 ? 45 : data.length > 30 ? 10 : data.length > 7 ? 4 : 0}
        />
        <YAxis
          domain={domain ?? ['auto', 'auto']}
          allowDecimals={false}
          tickFormatter={(v) => formatNumber(v)}
          tick={{ fontSize: 10, fill: '#8A8A9C' }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', borderRadius: 8, fontSize: 12 }}
          labelFormatter={(label) => label ? formatDate(String(label)) : ''}
          formatter={(v) => [formatNumber(Number(v)), label]}
        />
        <Area
          type="monotone"
          dataKey="followers"
          baseValue="dataMin"
          stroke="#FF7A8A"
          strokeWidth={2}
          fill="url(#followersGrad)"
          connectNulls
          dot={{ r: 2.5, strokeWidth: 0, fill: '#FF7A8A' }}
          activeDot={{ r: 4, fill: '#FF7A8A' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
