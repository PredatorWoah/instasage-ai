'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatDate, formatNumber } from '@/utils/formatters';
import type { TimeSeriesPoint } from '@/types';

type ViewsChartProps = {
  data: TimeSeriesPoint[];
};

export function ViewsChart({ data }: ViewsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 10, fill: '#8A8A9C' }}
          tickLine={false}
          axisLine={false}
          interval={data.length > 90 ? 45 : data.length > 30 ? 10 : data.length > 7 ? 4 : 0}
        />
        <YAxis
          tickFormatter={(v) => formatNumber(v)}
          tick={{ fontSize: 10, fill: '#8A8A9C' }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          contentStyle={{ background: '#17171F', border: '1px solid #2E2E3C', borderRadius: 8, fontSize: 12 }}
          labelFormatter={(label) => label ? formatDate(String(label)) : ''}
          formatter={(v: any) => [formatNumber(Number(v)), 'Views on posts from this day']}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Bar dataKey="views" fill="#8E78FF" radius={[3, 3, 0, 0]} maxBarSize={18} opacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  );
}
