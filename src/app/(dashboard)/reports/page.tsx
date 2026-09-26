'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { ArrowDownRight, ArrowUpRight, FileDown, FileSpreadsheet, Sparkles } from 'lucide-react';
import type { MonthlyReport } from '@/services/reports';
import type { ReportStory } from '@/services/ai';
import { useCachedJson, primeJson } from '@/lib/useCachedJson';
import { AiNotice } from '@/components/ai-assistant/AiNotice';
import { formatNumber } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { formatLabel, terms } from '@/lib/platform';

type StoryResult = { story: ReportStory; model: string; createdAt: string } | null;
const TOOLTIP = { background: '#17171F', border: '1px solid #2E2E3C', borderRadius: 12, fontSize: 12 };

const change = (now: number | null, before: number | null) =>
  now == null || before == null || before === 0 ? null : ((now - before) / Math.abs(before)) * 100;

export default function ReportsPage() {
  const [month, setMonth] = useState<string | null>(null);
  const reportUrl = `/api/reports/monthly${month ? `?month=${month}` : ''}`;
  const { data: report } = useCachedJson<MonthlyReport | null>(reportUrl);
  const active = month ?? report?.month ?? null;
  const storyUrl = active ? `/api/ai/report?month=${active}` : null;
  const { data: cachedStory } = useCachedJson<StoryResult>(storyUrl);
  const [fresh, setFresh] = useState<Record<string, StoryResult>>({});
  const [writing, setWriting] = useState(false);
  const [failure, setFailure] = useState<{ error: string; code?: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const story = (active && fresh[active]) || cachedStory || null;

  const writeStory = async () => {
    if (!active) return;
    setWriting(true);
    setFailure(null);
    const res = await fetch('/api/ai/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: active }) });
    const data = await res.json().catch(() => ({ error: 'The AI took too long. Try again.' }));
    if (res.ok) {
      setFresh((f) => ({ ...f, [active]: data }));
      primeJson(`/api/ai/report?month=${active}`, data);
    } else setFailure(data);
    setWriting(false);
  };

  const exportPdf = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const { downloadReportPdf } = await import('@/components/reports/reportPdf');
      await downloadReportPdf(report, story?.story ?? null);
      toast.success('PDF downloaded', { description: `${report.label} report${story ? ' with the AI review' : ''}.` });
    } catch (error) {
      console.error(error);
      toast.error('Could not build the PDF');
    }
    setExporting(false);
  };

  if (report === undefined) return <div className="h-[520px] rounded-[34px] bg-card animate-pulse" />;
  if (!report || report.accounts.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">Reports</h1>
        <p className="text-sm text-muted-foreground p-4 rounded-xl border border-dashed border-border">
          Connect an account on the <Link href="/accounts" className="text-indigo-400 hover:underline">Accounts page</Link> and sync to get monthly reports.
        </p>
      </div>
    );
  }

  const k = report.kpis;
  const p = report.previous.kpis;
  const prevName = report.previous.label.split(' ')[0];
  const t = terms(report.mode);
  const tiles = [
    { label: `${t.followers} gained`, value: k.followersGained == null ? '—' : `${k.followersGained >= 0 ? '+' : '−'}${formatNumber(Math.abs(k.followersGained))}`, delta: change(k.followersGained, p.followersGained), look: 'prism-sunset text-white' },
    { label: `Views on ${t.posts}`, value: formatNumber(k.views), delta: change(k.views, p.views), look: 'prism-ocean text-[#04151E]' },
    t.yt
      ? { label: 'Channel views gained', value: k.channelViews == null ? '—' : formatNumber(k.channelViews), delta: change(k.channelViews, p.channelViews), look: 'prism-gold text-[#2A1A00]' }
      : { label: 'Accounts reached', value: k.reach == null ? '—' : formatNumber(k.reach), delta: change(k.reach, p.reach), look: 'prism-gold text-[#2A1A00]' },
    { label: 'Avg engagement', value: `${k.engagement.toFixed(1)}%`, delta: change(k.engagement, p.engagement), look: 'bg-card border border-white/[0.05]' },
    { label: t.Posts, value: String(k.posts), delta: change(k.posts, p.posts), look: 'bg-card border border-white/[0.05]' },
    ...(t.hasSavesShares
      ? [
          { label: 'Saves', value: formatNumber(k.saves), delta: change(k.saves, p.saves), look: 'bg-card border border-white/[0.05]' },
          { label: 'Shares', value: formatNumber(k.shares), delta: change(k.shares, p.shares), look: 'bg-card border border-white/[0.05]' },
        ]
      : [{ label: 'Likes', value: formatNumber(k.likes), delta: change(k.likes, p.likes), look: 'bg-card border border-white/[0.05]' }]),
    { label: 'Comments', value: formatNumber(k.comments), delta: change(k.comments, p.comments), look: 'bg-card border border-white/[0.05]' },
  ];
  const headline = story?.story.headline ?? (k.posts ? `${k.posts} ${t.posts}, ${formatNumber(k.views)} views in ${report.label}.` : `Nothing posted in ${report.label} yet.`);
  const chart = report.days.map((d) => ({ day: Number(d.date.slice(8)), views: d.views, posts: d.posts }));

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">Reports</h1>
          <p className="text-[15px] text-muted-foreground mt-3">Your month in numbers, in {report.timeZone.replace(/_/g, ' ')} time. Download it as a PDF to share.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={active ?? ''}
            onChange={(e) => {
              setMonth(e.target.value);
              setFailure(null);
            }}
            className="h-11 rounded-full bg-white/[0.06] border border-white/[0.1] px-4 text-sm font-bold"
            aria-label="Month"
          >
            {report.months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <button onClick={exportPdf} disabled={exporting} className="h-11 px-5 rounded-full bg-white text-background text-sm font-bold inline-flex items-center gap-2 hover:scale-[1.03] active:scale-[0.97] transition-transform disabled:opacity-60">
            <FileDown className="w-4 h-4" /> {exporting ? 'Building PDF...' : 'Download PDF'}
          </button>
          <a href="/api/reports?type=csv" className="h-11 px-4 rounded-full bg-white/[0.06] border border-white/[0.1] text-sm font-bold inline-flex items-center gap-2 hover:bg-white/[0.1]">
            <FileSpreadsheet className="w-4 h-4" /> CSV
          </a>
        </div>
      </div>

      {/* Story */}
      <section className="animate-rise relative overflow-hidden rounded-[34px] prism-hero p-7 sm:p-9 flex flex-col gap-5">
        <div aria-hidden className="absolute right-[12%] -top-36 w-[420px] h-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(255,224,102,0.5),transparent)]" />
        <span className="relative self-start px-3.5 py-1.5 rounded-full glass-chip text-[13px] font-bold">{report.label} · {report.accounts.map((a) => `@${a.username}`).join(', ')}</span>
        <h2 className="relative text-[32px] sm:text-[48px] leading-[0.98] tracking-[-0.045em] text-balance max-w-[900px]">{headline}</h2>
        {story ? (
          <div className="relative grid md:grid-cols-3 gap-3">
            <p className="md:col-span-3 text-white/90 text-[15px] leading-relaxed max-w-[900px]">{story.story.summary}</p>
            {[
              { title: 'Wins', items: story.story.wins },
              { title: 'Watch outs', items: story.story.watchouts },
              { title: 'Next month', items: story.story.nextMonth },
            ].map((col) => (
              <div key={col.title} className="rounded-[22px] glass-chip p-4">
                <p className="text-[13px] font-bold mb-2">{col.title}</p>
                <ul className="space-y-1.5 text-[13px] leading-snug text-white/90 list-disc pl-4">{col.items?.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            ))}
            <button onClick={writeStory} disabled={writing} className="md:col-span-3 justify-self-start text-[12px] font-bold text-white/80 hover:text-white">
              {writing ? 'Rewriting...' : `Rewrite review · ${story.model}`}
            </button>
          </div>
        ) : (
          <button onClick={writeStory} disabled={writing} className="relative self-start inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white text-[#0A0A0F] text-sm font-bold hover:scale-[1.03] active:scale-[0.97] transition-transform disabled:opacity-70">
            <Sparkles className={cn('w-4 h-4', writing && 'animate-spin')} /> {writing ? 'Reading the month...' : 'Write the AI review'}
          </button>
        )}
      </section>
      {failure && <AiNotice code={failure.code} message={failure.error} />}

      {/* KPI tiles */}
      <section className="stagger grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <div key={t.label} className={cn('rounded-[30px] p-5 flex flex-col justify-between gap-6 min-h-[150px]', t.look)}>
            <span className="text-[13px] font-bold opacity-80">{t.label}</span>
            <div>
              <p className="font-display font-extrabold text-[40px] tracking-[-0.05em] leading-[0.9]">{t.value}</p>
              {t.delta != null && Number.isFinite(t.delta) && (
                <p className={cn('text-[12px] font-bold mt-2 inline-flex items-center gap-0.5', t.look.includes('bg-card') && (t.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'))}>
                  {t.delta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {Math.abs(t.delta).toFixed(0)}% vs {prevName}
                </p>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Daily chart + breakdowns */}
      <section className="stagger grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-[30px] p-5 sm:p-6 bg-card border border-white/[0.05]">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-lg font-bold">Views by day published</h3>
            <span className="text-xs text-muted-foreground">{report.label}</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="reportBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF5F8F" />
                  <stop offset="100%" stopColor="#7B61FF" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8A8A9C' }} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: '#8A8A9C' }} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(Number(v))} width={40} />
              <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v, _n, item) => [`${formatNumber(Number(v))} views · ${item.payload.posts} post${item.payload.posts === 1 ? '' : 's'}`, '']} labelFormatter={(d) => `Day ${d}`} />
              <Bar dataKey="views" fill="url(#reportBar)" radius={[6, 6, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-[30px] p-5 sm:p-6 bg-card border border-white/[0.05] space-y-3">
          <h3 className="text-lg font-bold">By format</h3>
          {report.byFormat.length === 0 && <p className="text-sm text-muted-foreground">No posts this month.</p>}
          {report.byFormat.map((f) => (
            <div key={f.label} className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{formatLabel(f.label)} <span className="text-muted-foreground font-medium">· {f.posts}</span></p>
                <p className={cn('text-[12px] font-bold', f.viewsLift >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{f.viewsLift >= 0 ? '+' : ''}{f.viewsLift}%</p>
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5">{formatNumber(f.avgViews)} avg views · {f.avgEngagement.toFixed(1)}% eng · {t.yt ? `${f.avgComments} comments` : `${f.avgSaves} saves`}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top posts */}
      {report.topPosts.length > 0 && (
        <section className="rounded-[30px] p-5 sm:p-6 bg-card border border-white/[0.05]">
          <h3 className="text-lg font-bold mb-4">Top {t.posts} of the month</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {report.topPosts.map((post, i) => (
              <Link key={post.id} href={`/content/${encodeURIComponent(post.id)}`} className="group rounded-[22px] overflow-hidden bg-white/[0.03] border border-white/[0.05]">
                <div className={cn('relative bg-[linear-gradient(160deg,#8C7BFF,#FF6F91)]', t.yt ? 'aspect-video' : 'aspect-[4/5]')}>
                  {post.thumbnail && <Image src={post.thumbnail} alt="" fill unoptimized sizes="220px" className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" />}
                  <span className="absolute left-2 top-2 font-display font-extrabold text-[13px] text-white drop-shadow">#{i + 1}</span>
                </div>
                <div className="p-3">
                  <p className="font-display font-extrabold text-[20px] leading-none">{formatNumber(post.views)} <span className="text-[12px] font-bold text-muted-foreground">views</span></p>
                  <p className="text-[11px] text-muted-foreground mt-1.5">{post.postedLocal} · {post.engagement.toFixed(1)}% eng</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
