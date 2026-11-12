import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { Sparkles } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { getAccountScope } from '@/lib/scope';
import { getTimeZone } from '@/lib/api';
import { formatLabel, terms } from '@/lib/platform';
import { PostThumb } from '@/components/dashboard/PostThumb';
import { getDashboardData } from '@/services/dashboard';
import { postVerdicts } from '@/services/ai';
import { sageFeed, type FeedItem } from '@/services/feed';
import { SageBriefing } from '@/components/dashboard/SageBriefing';
import { SageFeed } from '@/components/dashboard/SageFeed';
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
import { periodLabel, periodPhrase } from '@/lib/period';
import { AutoReview } from '@/components/dashboard/AutoReview';

export const metadata = { title: 'Overview' };

// "Sun 21 Sep, 7:30 pm" in the creator's timezone
const formatPosted = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(d);

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) redirect('/login');

  const [scope, timeZone] = await Promise.all([getAccountScope(session.user.id), getTimeZone(session.user.id)]);
  const [data, owner, feed] = await Promise.all([
    getDashboardData(scope, scope.span, timeZone),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { goal: true } }),
    sageFeed(session.user.id, scope).catch((error) => {
      console.error('Sage feed failed:', error);
      return [] as FeedItem[];
    }),
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
  const label = periodLabel(scope.days);
  const phrase = periodPhrase(scope.days);
  const short = scope.days == null ? 'all time' : `${scope.days} days`;
  const who = scope.key === 'all' ? 'all accounts' : `@${scope.profiles[0]?.username}`;

  // Until Sage has written a briefing (or with no AI key), the hero tells the story from the numbers
  const story =
    (kpis.followersChange > 0
      ? `You gained ${formatNumber(kpis.followersChange)} ${t.followersLower} ${scope.days == null ? "since InstaSage started tracking" : `in ${phrase}`}.`
      : hasData
        ? `${formatNumber(kpis.views)} views ${scope.days == null ? `across all your ${t.posts}` : `on your ${t.posts} from ${phrase}`}.`
        : 'Connect Instagram or YouTube to start your story.');
  const latest = data.latestPosts;
  const verdicts = await postVerdicts(session.user.id, latest.map((p) => p.id)).catch(() => ({} as Awaited<ReturnType<typeof postVerdicts>>));

  // Goal pace joins the feed, so the feed reads as one running story
  const feedItems: FeedItem[] = [...feed];
  if (forecast && hasData) {
    const pace = forecast.reached
      ? `Goal reached: ${formatNumber(forecast.current)} ${t.followersLower}, past your ${formatNumber(forecast.target)} target.`
      : forecast.onTrack != null
        ? `Goal pace: ${forecast.onTrack ? 'on track' : 'behind'} for ${formatNumber(forecast.target)} by ${forecast.deadlineLabel}. You're gaining ${forecast.perDay ?? 0} a day, ${forecast.neededPerDay} a day needed.`
        : forecast.eta
          ? `Goal: ${formatNumber(forecast.remaining)} ${t.followersLower} to go. At this pace you hit ${formatNumber(forecast.target)} around ${forecast.eta}.`
          : null;
    if (pace) feedItems.splice(Math.min(2, feedItems.length), 0, { id: 'goal', kind: 'goal', at: 0, ago: 'now', text: pace });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sage's daily briefing: rewritten after each sync */}
      <SageBriefing
        hasData={hasData}
        fallback={story}
        chip={`${scope.days == null ? 'All time' : label} · ${who}`}
        below={hasData ? (
          <Guard name="SinceLastVisit"><SinceLastVisit
            scopeKey={scope.key}
            followers={kpis.followers}
            unit={t.followersLower}
            postTimes={data.posts.map((p) => p.publishedAt.toISOString())}
            post={t.post}
            posts={t.posts}
          /></Guard>
        ) : undefined}
        actions={
          <SyncNowButton
            accounts={scope.profiles.map((p) => ({ id: p.id, username: p.username, platform: p.platform }))}
            syncedAgo={data.syncedMinutesAgo == null ? null : formatAge(data.syncedMinutesAgo)}
            stale={data.syncedMinutesAgo != null && data.syncedMinutesAgo > 24 * 60}
          />
        }
        side={
          <div className="flex gap-2.5">
            <div className="flex-1 px-4 py-3 rounded-[20px] glass-chip flex justify-between items-center gap-3">
              <span className="text-[13px] font-medium">New {t.followersLower}</span>
              <span className="font-display font-extrabold text-[22px]">{kpis.followersChange >= 0 ? '+' : '−'}{formatNumber(Math.abs(kpis.followersChange))}</span>
            </div>
            <div className="flex-1 px-4 py-3 rounded-[20px] glass-chip flex justify-between items-center gap-3">
              <span className="text-[13px] font-medium">{t.Posts}</span>
              <span className="font-display font-extrabold text-[22px]">{postsThisMonth}</span>
            </div>
          </div>
        }
      />

      <Guard name="SetupChecklist"><SetupChecklist /></Guard>

      {/* Live feed + the numbers */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-7 min-w-0"><SageFeed items={feedItems} /></div>
      <div className="lg:col-span-5 stagger grid grid-cols-2 gap-4 content-start">
        <div className="prism-sunset rounded-[30px] p-5 flex flex-col justify-between min-h-[190px]">
          <span className="self-start px-3 py-1.5 rounded-full bg-ink/25 text-[13px] font-bold">{t.followers}</span>
          <span className="font-display font-extrabold text-[34px] sm:text-[44px] tracking-[-0.05em] leading-[0.9]">{formatNumber(kpis.followers)}</span>
        </div>
        <div className="prism-ocean rounded-[30px] p-5 flex flex-col justify-between min-h-[190px] text-[#04151E]">
          <span className="self-start px-3 py-1.5 rounded-full bg-ink/30 text-[13px] font-bold" title={t.yt ? undefined : kpis.reach.unique ? 'Unique accounts reached in the last 30 days, from Instagram' : 'Daily reach added up over the window (Instagram only gives a unique count for 30 days)'}>{t.yt ? `Channel views · ${short}` : `Reached · ${short}`}</span>
          <span className="font-display font-extrabold text-[34px] sm:text-[44px] tracking-[-0.05em] leading-[0.9]">
            {t.yt ? (kpis.channelViews != null ? formatNumber(kpis.channelViews) : '—') : kpis.reach.value != null ? formatNumber(kpis.reach.value) : '—'}
          </span>
        </div>
        <div className="prism-gold rounded-[30px] p-5 flex flex-col justify-between min-h-[190px] text-[#2A1A00]">
          <span className="self-start px-3 py-1.5 rounded-full bg-ink/35 text-[13px] font-bold" title={`Total interactions divided by total ${t.yt ? 'views' : 'reach'} across ${kpis.engagementPosts} ${t.posts} from ${phrase}`}>Engagement</span>
          <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
            <span className="font-display font-extrabold text-[34px] sm:text-[44px] tracking-[-0.05em] leading-[0.9]">{kpis.engagement.toFixed(1)}%</span>
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
      </div>
      </section>
      {/* Latest posts */}
      <AutoReview pending={hasData} />
      {latest.length > 0 && (
        <section className="rounded-[30px] p-5 sm:p-6 bg-card border border-ink/[0.05] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Latest {t.posts} <span className="text-sm font-medium text-muted-foreground">· reviewed by Sage</span></h2>
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
                      {verdicts[post.id]?.bestFor && <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-[11px] font-bold">Good for {verdicts[post.id].bestFor.toLowerCase().slice(0, 28)}</span>}
                    </span>
                    {verdicts[post.id]?.verdict && (
                      <span className="flex gap-1.5 text-[11.5px] leading-snug text-muted-foreground" title={verdicts[post.id].verdict}>
                        <Sparkles className="w-3 h-3 mt-0.5 shrink-0 text-violet-400" />
                        <span className="line-clamp-2">{verdicts[post.id].verdict}</span>
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Top posts, goal and best time */}
      <section className="stagger grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-[30px] p-5 sm:p-6 bg-card border border-ink/[0.05] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Top {t.posts} <span className="text-sm font-medium text-muted-foreground">· {label.toLowerCase()}</span></h2>
            <Link href="/content" transitionTypes={['nav-forward']} className="text-[13px] font-bold text-amber-300 hover:text-amber-200">All content →</Link>
          </div>
          {data.topPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8">{hasData ? `No ${t.posts} in ${phrase}. Pick a longer time window at the top.` : 'Nothing synced yet. Connect an account and press Sync on the Accounts page.'}</p>
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
        <Guard name="BestTimeTile"><BestTimeTile /></Guard>
        </div>
      </section>

      {/* Trends */}
      <section className="stagger grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-[30px] p-5 sm:p-6 bg-card border border-ink/[0.05] flex flex-col gap-3">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">{t.followers}</h2><span className="text-xs text-muted-foreground">{label}</span></div>
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
