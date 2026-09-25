'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockReports } from '@/data/mockReports';
import { formatNumber } from '@/utils/formatters';

// Reverse to show chronologically: April -> May -> June
const chartData = [...mockReports].reverse().map((r) => ({
  month: r.month,
  followersGained: r.summary.totalFollowersGained,
  reach: r.summary.totalReach,
  views: r.summary.totalViews,
  engagementRate: r.summary.avgEngagementRate,
}));

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">Monthly Reports</h1>
        <p className="text-[15px] text-muted-foreground mt-3">
          Historical month-over-month performance comparison (Charts Only)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Followers Gained Comparison */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Monthly Followers Gained</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={32} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8A8A9C' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8A8A9C' }} tickLine={false} axisLine={false} tickFormatter={formatNumber} width={48} />
                <Tooltip
                  contentStyle={{ background: '#17171F', border: '1px solid #2E2E3C', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [formatNumber(Number(v)), 'Followers Gained']}
                />
                <Bar dataKey="followersGained" fill="#FF7A8A" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Unique Reach Comparison */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Monthly Unique Reach</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={32} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8A8A9C' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8A8A9C' }} tickLine={false} axisLine={false} tickFormatter={formatNumber} width={48} />
                <Tooltip
                  contentStyle={{ background: '#17171F', border: '1px solid #2E2E3C', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [formatNumber(Number(v)), 'Unique Reach']}
                />
                <Bar dataKey="reach" fill="#3CC8E8" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Total Views Comparison */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Monthly Total Views</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={32} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8A8A9C' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8A8A9C' }} tickLine={false} axisLine={false} tickFormatter={formatNumber} width={48} />
                <Tooltip
                  contentStyle={{ background: '#17171F', border: '1px solid #2E2E3C', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [formatNumber(Number(v)), 'Total Views']}
                />
                <Bar dataKey="views" fill="#8E78FF" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Average Engagement Rate Comparison */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Average Engagement Rate</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8A8A9C' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8A8A9C' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={32} />
                <Tooltip
                  contentStyle={{ background: '#17171F', border: '1px solid #2E2E3C', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [`${v}%`, 'Avg Engagement']}
                />
                <Line type="monotone" dataKey="engagementRate" stroke="#FFD15C" strokeWidth={3} dot={{ r: 4, fill: '#FFD15C' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
