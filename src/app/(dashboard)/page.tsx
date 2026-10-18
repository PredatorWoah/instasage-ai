import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { ArrowRight, Sparkles } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { getAccountScope } from '@/lib/scope';
import { getTimeZone } from '@/lib/api';
import { formatLabel, terms } from '@/lib/platform';
import { PostThumb } from '@/components/dashboard/PostThumb';
import { getDashboardData } from '@/services/dashboard';
import { getCachedResult, type AiRecommendation, type Insight } from '@/services/ai';
import { EngagementChart, FollowersChart } from '@/components/charts/LazyCharts';
import { BestTimeTile } from '@/components/dashboard/BestTimeTile';
import { formatAge, formatNumber, getPerformanceLabel } from '@/utils/formatters';
import { SyncNowButton } from '@/components/dashboard/SyncNowButton';
import { SinceLastVisit } from '@/components/dashboard/SinceLastVisit';
import { GoalCard } from '@/components/dashboard/GoalCard';
import { SetupChecklist } from '@/components/dashboard/SetupChecklist';
import { followersPerDay, goalForecast, type Goal } from '@/lib/goal';
import { prisma } from '@/lib/prisma';
import { Guard } from '@/components/ui/Guard';

export const metadata = { title: 'Overview · InstaSage' };

// "Sun 21 Sep, 7:30 pm" in the creator's timezone
const formatPosted = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(d);

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) redirect('/login');

  const [scope, timeZone] = await Promise.all([getAccountScope(session.user.id), getTimeZone(session.user.id)]);
  const [data, insights, ideas, owner] = await Promise.all([
    getDashboardData(scope, 30, timeZone),
    getCachedResult<Insight>(session.user.id, 'insights', scope.key),
    getCachedResult<AiRecommendation>(session.user.id, 'recommendations', scope.key),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { goal: true } }),
  ]);

  const { kpis, timeSeries } = data;
  const postsThisMonth = timeSeries.reduce((a, p) => a + (p.posts ?? 0), 0);
  const recentViews = timeSeries.slice(-14);
  const maxViews = Math.max(1, ...recentViews.map((p) => p.views ?? 0));
  const hasData = data.profiles.length > 0;
  const t = terms(scope.mode);
  // A bad goal value must never take the whole Overview down; worst case the card shows no forecast
  let forecast: ReturnType<typeof goalForecast> = null;
  try {
    forecast = goalForecast(owner?.goal as Goal | null, kpis.followers, followersPerDay(timeSeries), timeZone);
  } catch (error) {
    console.error('Goal forecast failed:', error, owner?.goal);
  }
  const who = scope.key === 'all' ? 'all accounts' : `@${scope.profiles[0]?.username}`;

  // The banner tells the month's story: the latest AI insight, or a line built from the numbers
  const story =
    insights?.items[0]?.title ??
    (kpis.followersChange > 0
      ? `You gained ${formatNumber(kpis.followersChange)} ${t.followersLower} in the last 30 days.`
      : hasData
        ? `${formatNumber(kpis.views)} views across your ${t.posts} so far.`
        : 'Connect Instagram or YouTube to start your story.');
  const idea = ideas?.items[0];
  const latest = data.latestPosts;

  return (
    <div className="flex flex-col gap-4">
      {/* Story banner */}
      <section className="animate-rise relative overflow-hidden rounded-[34px] prism-hero p-7 sm:p-9 flex flex-col lg:flex-row lg:items-stretch justify-between gap-6 min-h-[250px]">
        <div aria-hidden className="absolute right-[18%] -top-36 w-[420px] h-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(255,224,102,0.55),transparent)]" />
        <div className="relative flex flex-col justify-between gap-6 max-w-[720px]">
          <span className="self-start inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-chip text-[13px] font-bold">
            <Sparkles className="w-3.5 h-3.5" /> Your last 30 days · {who}
          </span>
          <div className="space-y-2">
            <h1 className="text-[40px] sm:text-[56px] leading-[0.98] tracking-[-0.045em] text-balance">{story}</h1>
            {hasData && (
              <Guard name="SinceLastVisit"><SinceLastVisit
                scopeKey={scope.key}
                followers={kpis.followers}
                unit={t.followersLower}
                postTimes={data.posts.map((p) => p.publishedAt.toISOString())}
                post={t.post}
                posts={t.posts}
              /></Guard>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <SyncNowButton
              accounts={scope.profiles.map((p) => ({ id: p.id, username: p.username, platform: p.platform }))}
              syncedAgo={data.syncedMinutesAgo == null ? null : formatAge(data.syncedMinutesAgo)}
              stale={data.syncedMinutesAgo != null && data.syncedMinutesAgo > 24 * 60}
            />
            {insights?.items[0] && (
              <Link href="/insights" transitionTypes={['nav-forward']} className="text-sm font-semibold text-white/90 hover:text-white inline-flex items-center gap-1.5">
                Read the full analysis <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
        <div className="relative flex flex-row lg:flex-col gap-2.5 justify-end lg:w-[280px]">
          <div className="flex-1 lg:flex-none px-4 py-3.5 rounded-[20px] glass-chip flex justify-between items-center gap-3">
            <span className="text-sm font-medium">New {t.followersLower}</span>
            <span className="font-display font-extrabold text-[26px]">{kpis.followersChange >= 0 ? '+' : '−'}{formatNumber(Math.abs(kpis.followersChange))}</span>
          </div>
          <div className="flex-1 lg:flex-none px-4 py-3.5 rounded-[20px] glass-chip flex justify-between items-center gap-3">
            <span className="text-sm font-medium">{t.Posts} published</span>
            <span className="font-display font-extrabold text-[26px]">{postsThisMonth}</span>
          </div>
        </div>
      </section>

      <Guard name="SetupChecklist"><SetupChecklist /></Guard>

      {/* Stat tiles */}
      <section className="stagger grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="prism-sunset rounded-[30px] p-5 flex flex-col justify-between min-h-[190px]">
          <span className="self-start px-3 py-1.5 rounded-full bg-ink/25 text-[13px] font-bold">{t.followers}</span>
          <span className="font-display font-extrabold text-[38px] sm:text-[52px] xl:text-[60px] tracking-[-0.05em] leading-[0.9]">{formatNumber(kpis.followers)}</span>
        </div>
        <div className="prism-ocean rounded-[30px] p-5 flex flex-col justify-between min-h-[190px] text-[#04151E]">
          <span className="self-start px-3 py-1.5 rounded-full bg-ink/30 text-[13px] font-bold">{t.yt ? 'Channel views · 30 days' : 'Reached · 30 days'}</span>
          <span className="font-display font-extrabold text-[38px] sm:text-[52px] xl:text-[60px] tracking-[-0.05em] leading-[0.9]">
            {t.yt ? (kpis.channelViews != null ? formatNumber(kpis.channelViews) : '—') : kpis.reach30 != null ? formatNumber(kpis.reach30) : '—'}
          </span>
        </div>
        <div className="prism-gold rounded-[30px] p-5 flex flex-col justify-between min-h-[190px] text-[#2A1A00]">
          <span className="self-start px-3 py-1.5 rounded-full bg-ink/35 text-[13px] font-bold" title={`Total interactions divided by total ${t.yt ? 'views' : 'reach'} across ${kpis.engagementPosts} ${t.posts} from the last 30 days`}>Engagement</span>
          <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
            <span className="font-display font-extrabold text-[38px] sm:text-[52px] xl:text-[60px] tracking-[-0.05em] leading-[0.9]">{kpis.engagement.toFixed(1)}%</span>
            {hasData && <span className="text-[13px] font-bold pb-1">{getPerformanceLabel(kpis.engagement)}</span>}
          </div>
        </div>
        <div className="rounded-[30px] p-5 bg-card border border-ink/[0.05] flex flex-col justify-between min-h-[190px]">
          <div className="flex items-center justify-between gap-2">
            <span className="px-3 py-1.5 rounded-full bg-ink/[0.07] text-[13px] font-bold text-muted-foreground">Views</span>
            <span className="font-display font-extrabold text-[22px]">{formatNumber(kpis.views)}</span>
          </div>
          <div className="flex items-end gap-1.5 h-[88px]" aria-label={`Views on ${t.posts} from the last 14 days`}>
            {recentViews.map((p) => {
              const v = p.views ?? 0;
              const tall = v >= maxViews * 0.75;
              return (
                <div
                  key={p.date}
                  title={`${p.date}: ${formatNumber(v)} views`}
                  className="flex-1 rounded-[6px]"
                  style={{
                    height: `${Math.max(6, (v / maxViews) * 100)}%`,
                    background: v === 0 ? '#23232E' : tall ? 'linear-gradient(#FF5F8F, #7B61FF)' : '#34344A',
                  }}
                />
              );
            })}
          </div>
        </div>
        <Guard name="BestTimeTile"><BestTimeTile /></Guard>
      </section>

      {/* Top posts + AI */}
      <section className="stagger grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-[30px] p-5 sm:p-6 bg-card border border-ink/[0.05] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Top {t.posts}</h2>
            <Link href="/content" transitionTypes={['nav-forward']} className="text-[13px] font-bold text-amber-300 hover:text-amber-200">All content →</Link>
          </div>
          {data.topPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8">Nothing synced yet. Connect an account and press Sync on the Accounts page.</p>
          ) : (
            <div className={t.yt ? 'grid grid-cols-2 sm:grid-cols-3 gap-3' : 'grid grid-cols-3 sm:grid-cols-5 gap-3'}>
              {data.topPosts.map((post, i) => (
                <Link
                  key={post.id}
                  href={`/content/${encodeURIComponent(post.id)}`}
                  transitionTypes={['page-fade']}
                  aria-label={post.caption.slice(0, 80) || `Open ${t.post}`}
                  className={`group relative ${post.platform === 'youtube' ? 'aspect-video' : 'aspect-[4/5]'} rounded-[20px] overflow-hidden on-color bg-[linear-gradient(160deg,#8C7BFF,#FF6F91)]`}
                >
                  <PostThumb src={post.thumbnail} type={post.type} sizes="200px" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <span className="absolute left-2 top-2 font-display font-extrabold text-[13px] text-white/90">#{i + 1}</span>
                  <span className="absolute left-2 bottom-2 px-2.5 py-1 rounded-full bg-[rgba(10,10,15,0.8)] text-white text-[12px] font-bold">
                    {post.performanceScore.toFixed(1)}%
                  </span>
                  {post.isBoosted && <span className="absolute right-2 top-2 px-2 py-0.5 rounded-full bg-amber-500/90 text-[10px] font-bold text-black">Boosted</span>}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
        <Guard name="GoalCard"><GoalCard forecast={forecast} current={kpis.followers} unit={t.followersLower} perDay={followersPerDay(timeSeries)} timeZone={timeZone} /></Guard>
        <div className="flex-1 rounded-[30px] p-6 bg-white text-[#0A0A0F] flex flex-col gap-3">
          <span className="text-[13px] font-bold prism-text">AI recommends</span>
          <p className="font-display font-extrabold text-[26px] leading-[1.05] tracking-[-0.03em]">
            {idea ? idea.title : 'Get a 30-day game plan built from your own numbers.'}
          </p>
          {idea?.description && <p className="text-sm text-[#4A4A5A] leading-relaxed line-clamp-3">{idea.description}</p>}
          <Link
            href="/recommendations"
            transitionTypes={['nav-forward']}
            className="mt-auto self-start inline-flex items-center gap-1.5 h-11 px-5 rounded-full bg-[#0A0A0F] text-white text-[13px] font-bold hover:scale-[1.03] active:scale-[0.97] transition-transform"
          >
            {idea ? 'See all ideas' : 'Generate ideas'} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        </div>
      </section>

      {/* Latest posts */}
      {latest.length > 0 && (
        <section className="rounded-[30px] p-5 sm:p-6 bg-card border border-ink/[0.05] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Latest {t.posts}</h2>
            <Link href="/content" transitionTypes={['nav-forward']} className="text-[13px] font-bold text-amber-300 hover:text-amber-200">All content →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {latest.map((post) => {
              const yt = post.platform === 'youtube';
              const vsAvg = kpis.avgViews > 0 && !post.isBoosted ? Math.round(((post.views - kpis.avgViews) / kpis.avgViews) * 100) : null;
              const stats = [
                { label: 'views', value: post.views },
                { label: 'likes', value: post.likes },
                { label: 'comments', value: post.comments },
                ...(yt ? [] : [{ label: 'saves', value: post.saves }, { label: 'shares', value: post.shares }]),
              ];
              return (
                <Link
                  key={post.id}
                  href={`/content/${encodeURIComponent(post.id)}`}
                  transitionTypes={['page-fade']}
                  className="group flex gap-3 rounded-[22px] p-3 bg-ink/[0.03] border border-ink/[0.06] hover:bg-ink/[0.06] transition-colors"
                >
                  <span className={`relative shrink-0 rounded-[16px] overflow-hidden on-color bg-[linear-gradient(160deg,#8C7BFF,#FF6F91)] ${yt && post.type !== 'short' ? 'w-[112px] aspect-video self-start' : 'w-[84px] aspect-[4/5]'}`}>
                    <PostThumb src={post.thumbnail} type={post.type} sizes="112px" />
                  </span>
                  <span className="min-w-0 flex-1 flex flex-col gap-1.5">
                    <span className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                      <b className="text-foreground">{formatLabel(post.type)}</b>
                      <span>·</span>
                      <span>{formatPosted(post.publishedAt, timeZone)}</span>
                    </span>
                    <span className="text-[13px] font-semibold leading-snug line-clamp-2">{post.caption || (yt ? 'Untitled video' : 'No caption')}</span>
                    <span className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
                      {stats.map((x) => <span key={x.label}><b className="text-foreground">{formatNumber(x.value)}</b> {x.label}</span>)}
                    </span>
                    <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="px-2 py-0.5 rounded-full bg-ink/[0.07] text-[11px] font-bold">{post.performanceScore.toFixed(1)}% eng</span>
                      {post.ageDays < 2 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-bold" title="Numbers keep climbing for the first day or two">Still collecting</span>
                      ) : vsAvg != null ? (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${vsAvg >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {vsAvg >= 0 ? '+' : ''}{vsAvg}% vs avg views
                        </span>
                      ) : null}
                      {post.isBoosted && <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-bold">Boosted</span>}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Trends */}
      <section className="stagger grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-[30px] p-5 sm:p-6 bg-card border border-ink/[0.05] flex flex-col gap-3">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">{t.followers}</h2><span className="text-xs text-muted-foreground">30 days</span></div>
          <FollowersChart data={timeSeries} label={t.followers} />
        </div>
        <div className="rounded-[30px] p-5 sm:p-6 bg-card border border-ink/[0.05] flex flex-col gap-3">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">Engagement</h2><span className="text-xs text-muted-foreground">{t.Posts} per day vs your average</span></div>
          <EngagementChart data={timeSeries} />
        </div>
      </section>
    </div>
  );
}
