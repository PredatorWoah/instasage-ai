'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber } from '@/utils/formatters';

export type Snapshot = { hours: number; views: number; likes: number; comments: number; saves: number; shares: number };

const age = (h: number) => (h < 24 ? `${h}h` : `${Math.round(h / 24)}d`);

// Views by hours since posting, from the points each sync records during a post's first two weeks
export function GrowthCurve({ data }: { data: Snapshot[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8E78FF" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#8E78FF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,160,0.15)" vertical={false} />
        <XAxis dataKey="hours" type="number" domain={['dataMin', 'dataMax']} tickFormatter={age} tick={{ fontSize: 10, fill: '#8A8A9C' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10, fill: '#8A8A9C' }} tickLine={false} axisLine={false} width={48} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', borderRadius: 8, fontSize: 12 }}
          labelFormatter={(h) => `${age(Number(h))} after posting`}
          formatter={(v) => [formatNumber(Number(v)), 'Views']}
        />
        <Area type="monotone" dataKey="views" stroke="#8E78FF" strokeWidth={2} fill="url(#growth-fill)" dot={{ r: 2.5, fill: '#8E78FF' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
