'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { formatDate } from '@/utils/formatters';
import type { TimeSeriesPoint } from '@/types';

type EngagementChartProps = {
  data: TimeSeriesPoint[];
};

export function EngagementChart({ data }: EngagementChartProps) {
  // Your own average for the period, drawn as a dashed guide
  const values = data.map((d) => d.engagement).filter((v): v is number => v != null);
  const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 10, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          interval={data.length > 90 ? 45 : data.length > 30 ? 10 : data.length > 7 ? 4 : 0}
        />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 10, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        {average !== null && (
          <ReferenceLine
            y={average}
            stroke="#64748b"
            strokeDasharray="3 3"
            strokeOpacity={0.6}
            label={{ value: `avg ${average.toFixed(1)}%`, position: 'insideTopRight', fontSize: 10, fill: '#64748b' }}
          />
        )}
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
          labelFormatter={(label) => label ? formatDate(String(label)) : ''}
          formatter={(v: any) => [`${v}%`, 'Engagement Rate']}
        />
        <Line
          type="monotone"
          dataKey="engagement"
          stroke="#ec4899"
          strokeWidth={2}
          dot={{ r: 2.5, strokeWidth: 0, fill: '#ec4899' }}
          connectNulls
          activeDot={{ r: 4, fill: '#ec4899' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
