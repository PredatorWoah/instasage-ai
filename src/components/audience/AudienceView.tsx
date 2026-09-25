'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatNumber } from '@/utils/formatters';
import type { Post } from '@/types';

type Row = { label: string; value: number };
type AudienceResponse = {
  username: string;
  followerCount: number;
  lastSyncedAt: string;
  audience: { age: Row[]; gender: Row[]; country: Row[]; city: Row[] } | null;
} | null;

const TOOLTIP = { background: '#17171F', border: '1px solid #2E2E3C', borderRadius: 8, fontSize: 12 };
const GENDER: Record<string, { label: string; color: string }> = {
  F: { label: 'Women', color: '#FFD15C' },
  M: { label: 'Men', color: '#FF7A8A' },
  U: { label: 'Unspecified', color: '#8A8A9C' },
};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const withShare = (rows: Row[]) => {
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return rows.map((r) => ({ ...r, share: Number(((r.value / total) * 100).toFixed(1)) }));
};

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function ShareList({ title, rows, format }: { title: string; rows: (Row & { share: number })[]; format?: (s: string) => string }) {
  const max = Math.max(...rows.map((r) => r.share), 1);
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {rows.slice(0, 7).map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-xs truncate">{format ? format(r.label) : r.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{r.share}% · {formatNumber(r.value)}</span>
            </div>
            <Progress value={(r.share / max) * 100} className="h-1.5" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AudienceView() {
  const [data, setData] = useState<AudienceResponse | undefined>(undefined);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetch('/api/audience').then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => setData(null));
    fetch('/api/posts').then((r) => (r.ok ? r.json() : [])).then(setPosts).catch(() => setPosts([]));
  }, []);

  // Average engagement by weekday and hour, in the viewer's own timezone
  const timing = useMemo(() => {
    const byDay = WEEKDAYS.map((d) => ({ label: d, total: 0, count: 0 }));
    const byHour = Array.from({ length: 24 }, (_, h) => ({ label: `${h}:00`, total: 0, count: 0 }));
    for (const p of posts) {
      const d = new Date(p.publishedAt);
      byDay[d.getDay()].total += p.performanceScore;
      byDay[d.getDay()].count += 1;
      byHour[d.getHours()].total += p.performanceScore;
      byHour[d.getHours()].count += 1;
    }
    const avg = (rows: typeof byDay) => rows.map((r) => ({ label: r.label, engagement: r.count ? Number((r.total / r.count).toFixed(1)) : 0, posts: r.count }));
    return { days: avg(byDay), hours: avg(byHour) };
  }, [posts]);

  if (data === undefined) return <div className="h-96 rounded-xl border border-border bg-secondary/10 animate-pulse" />;

  const audience = data?.audience;
  const age = audience ? withShare([...audience.age].sort((a, b) => a.label.localeCompare(b.label))) : [];
  const gender = audience ? withShare(audience.gender) : [];
  const countries = audience ? withShare(audience.country) : [];
  const cities = audience ? withShare(audience.city) : [];
  const bestDay = [...timing.days].sort((a, b) => b.engagement - a.engagement)[0];
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">Audience</h1>
        <p className="text-[15px] text-muted-foreground mt-3">
          {data ? `Who follows @${data.username} (${formatNumber(data.followerCount)} followers), from Instagram` : 'Who follows you, from Instagram'}
        </p>
      </div>

      {!data ? (
        <p className="text-sm text-muted-foreground p-4 rounded-xl border border-dashed border-border">
          Connect Instagram in <Link href="/settings" className="text-indigo-400 hover:underline">Settings</Link> and press Sync to see your audience.
        </p>
      ) : !audience ? (
        <p className="text-sm text-muted-foreground p-4 rounded-xl border border-dashed border-border">
          No demographics yet. Press Sync on the <Link href="/accounts" className="text-indigo-400 hover:underline">Accounts page</Link>.
          Instagram only shares follower demographics for accounts with at least 100 followers, and needs the
          instagram_business_manage_insights permission on your token.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">Age</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={age} barSize={28} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8A8A9C' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#8A8A9C' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={36} />
                    <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v) => [`${v}%`, 'Followers']} />
                    <Bar dataKey="share" fill="#FF7A8A" radius={[3, 3, 0, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-sm font-semibold">Gender</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={gender} dataKey="share" nameKey="label" innerRadius={50} outerRadius={75} paddingAngle={2} stroke="none">
                      {gender.map((g) => <Cell key={g.label} fill={GENDER[g.label]?.color ?? '#8A8A9C'} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP} formatter={(v, _n, item) => [`${v}%`, GENDER[item.payload.label]?.label ?? item.payload.label]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 shrink-0">
                  {gender.map((g) => (
                    <div key={g.label} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: GENDER[g.label]?.color ?? '#8A8A9C' }} />
                      <span>{GENDER[g.label]?.label ?? g.label}</span>
                      <span className="text-muted-foreground tabular-nums">{g.share}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ShareList title="Top countries" rows={countries} format={countryName} />
            <ShareList title="Top cities" rows={cities} />
          </div>
        </>
      )}

      {posts.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">When your posts do best</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Average engagement of your synced posts by the day and hour they went up ({timezone})
              {bestDay?.posts ? `. Best day so far: ${bestDay.label} at ${bestDay.engagement}%` : ''}
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ rows: timing.days, key: 'days' }, { rows: timing.hours, key: 'hours' }].map(({ rows, key }) => (
              <ResponsiveContainer key={key} width="100%" height={180}>
                <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8A8A9C' }} tickLine={false} axisLine={false} interval={key === 'hours' ? 3 : 0} />
                  <YAxis tick={{ fontSize: 10, fill: '#8A8A9C' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={36} />
                  <Tooltip
                    contentStyle={TOOLTIP}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    formatter={(v, _n, item) => [`${v}% avg engagement (${item.payload.posts} posts)`, '']}
                  />
                  <Bar dataKey="engagement" fill="#4ADE9E" radius={[3, 3, 0, 0]} opacity={0.85} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
