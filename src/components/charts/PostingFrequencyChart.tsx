'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatDate } from '@/utils/formatters';
import type { TimeSeriesPoint } from '@/types';

type PostingFrequencyChartProps = {
  data: TimeSeriesPoint[];
  label?: string;
};

export function PostingFrequencyChart({ data, label = 'Posts' }: PostingFrequencyChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={6}>
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
          allowDecimals={false}
          tick={{ fontSize: 10, fill: '#8A8A9C' }}
          tickLine={false}
          axisLine={false}
          width={24}
        />
        <Tooltip
          contentStyle={{ background: '#17171F', border: '1px solid #2E2E3C', borderRadius: 8, fontSize: 12 }}
          labelFormatter={(label) => label ? formatDate(String(label)) : ''}
          formatter={(v) => [v, label]}
        />
        <Bar dataKey="posts" fill="#4ADE9E" radius={[3, 3, 0, 0]} opacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  );
}
