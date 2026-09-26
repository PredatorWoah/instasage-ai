import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getServerSession } from 'next-auth';
import { ArrowRight, Sparkles } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { getAccountScope } from '@/lib/scope';
import { getTimeZone } from '@/lib/api';
import { terms } from '@/lib/platform';
import { getDashboardData } from '@/services/dashboard';
import { getCachedResult, type AiRecommendation, type Insight } from '@/services/ai';
import { FollowersChart } from '@/components/charts/FollowersChart';
import { EngagementChart } from '@/components/charts/EngagementChart';
import { BestTimeTile } from '@/components/dashboard/BestTimeTile';
import { formatNumber, getPerformanceLabel } from '@/utils/formatters';

export const metadata = { title: 'Overview · InstaSage' };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) redirect('/login');

  const [scope, timeZone] = await Promise.all([getAccountScope(session.user.id), getTimeZone(session.user.id)]);
  const month = new Date().toLocaleString('en-US', { month: 'long', timeZone });
  const [data, insights, ideas] = await Promise.all([
    getDashboardData(scope, 30, timeZone),
    getCachedResult<Insight>(session.user.id, 'insights', scope.key),
    getCachedResult<AiRecommendation>(session.user.id, 'recommendations', scope.key),
  ]);

  const { kpis, timeSeries } = data;
  const postsThisMonth = timeSeries.reduce((a, p) => a + (p.posts ?? 0), 0);
  const reachDays = timeSeries.filter((p) => p.reach !== undefined);
  const reach30 = reachDays.reduce((a, p) => a + (p.reach ?? 0), 0);
  const recentViews = timeSeries.slice(-14);
  const maxViews = Math.max(1, ...recentViews.map((p) => p.views ?? 0));
  const hasData = data.profiles.length > 0;
  const t = terms(scope.mode);
  const who = scope.key === 'all' ? 'all accounts' : `@${scope.profiles[0]?.username}`;

  // The banner tells the month's story: the latest AI insight, or a line built from the numbers
  const story =
    insights?.items[0]?.title ??
    (kpis.followersChange > 0
      ? `You gained ${formatNumber(kpis.followersChange)} ${t.followersLower} this month.`
      : hasData
        ? `${formatNumber(kpis.views)} views across your ${t.posts} so far.`
        : 'Connect Instagram or YouTube to start your story.');
  const idea = ideas?.items[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Story banner */}
      <section className="animate-rise relative overflow-hidden rounded-[34px] prism-hero p-7 sm:p-9 flex flex-col lg:flex-row lg:items-stretch justify-between gap-6 min-h-[250px]">
        <div aria-hidden className="absolute right-[18%] -top-36 w-[420px] h-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(255,224,102,0.55),transparent)]" />
        <div className="relative flex flex-col justify-between gap-6 max-w-[720px]">
          <span className="self-start inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-chip text-[13px] font-bold">
            <Sparkles className="w-3.5 h-3.5" /> Your {month} story · {who}
          </span>
          <h1 className="text-[40px] sm:text-[56px] leading-[0.98] tracking-[-0.045em] text-balance">{story}</h1>
          {insights?.items[0] && (
            <Link href="/insights" transitionTypes={['nav-forward']} className="self-start text-sm font-semibold text-white/90 hover:text-white inline-flex items-center gap-1.5">
              Read the full analysis <ArrowRight className="w-4 h-4" />
            </Link>
          )}
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

      {/* Stat tiles */}
      <section className="stagger grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="prism-sunset rounded-[30px] p-5 flex flex-col justify-between min-h-[190px]">
          <span className="self-start px-3 py-1.5 rounded-full bg-white/25 text-[13px] font-bold">{t.followers}</span>
          <span className="font-display font-extrabold text-[52px] xl:text-[60px] tracking-[-0.05em] leading-[0.9]">{formatNumber(kpis.followers)}</span>
        </div>
        <div className="prism-ocean rounded-[30px] p-5 flex flex-col justify-between min-h-[190px] text-[#04151E]">
          <span className="self-start px-3 py-1.5 rounded-full bg-white/30 text-[13px] font-bold">{t.yt ? 'Channel views · 30 days' : 'Reach · 30 days'}</span>
          <span className="font-display font-extrabold text-[52px] xl:text-[60px] tracking-[-0.05em] leading-[0.9]">
            {t.yt ? (kpis.channelViews != null ? formatNumber(kpis.channelViews) : '—') : reachDays.length ? formatNumber(reach30) : '—'}
          </span>
        </div>
        <div className="prism-gold rounded-[30px] p-5 flex flex-col justify-between min-h-[190px] text-[#2A1A00]">
          <span className="self-start px-3 py-1.5 rounded-full bg-white/35 text-[13px] font-bold">Engagement</span>
          <div className="flex items-end justify-between gap-2">
            <span className="font-display font-extrabold text-[52px] xl:text-[60px] tracking-[-0.05em] leading-[0.9]">{kpis.engagement.toFixed(1)}%</span>
            {hasData && <span className="text-[13px] font-bold pb-1">{getPerformanceLabel(kpis.engagement)}</span>}
          </div>
        </div>
        <div className="rounded-[30px] p-5 bg-card border border-white/[0.05] flex flex-col justify-between min-h-[190px]">
          <div className="flex items-center justify-between gap-2">
            <span className="px-3 py-1.5 rounded-full bg-white/[0.07] text-[13px] font-bold text-muted-foreground">Views</span>
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
        <BestTimeTile />
      </section>

      {/* Top posts + AI */}
      <section className="stagger grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-[30px] p-5 sm:p-6 bg-card border border-white/[0.05] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Top {t.posts}</h2>
            <Link href="/content" transitionTypes={['nav-forward']} className="text-[13px] font-bold text-[#FFE08A] hover:text-[#FFF0C2]">All content →</Link>
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
                  className={`group relative ${post.platform === 'youtube' ? 'aspect-video' : 'aspect-[4/5]'} rounded-[20px] overflow-hidden bg-[linear-gradient(160deg,#8C7BFF,#FF6F91)]`}
                >
                  {post.thumbnail && (
                    <Image src={post.thumbnail} alt={post.caption.slice(0, 80)} fill unoptimized sizes="200px" className="object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <span className="absolute left-2 top-2 font-display font-extrabold text-[13px] text-white/90">#{i + 1}</span>
                  <span className="absolute left-2 bottom-2 px-2.5 py-1 rounded-full bg-[rgba(10,10,15,0.8)] text-[12px] font-bold">
                    {post.performanceScore.toFixed(1)}%
                  </span>
                  {post.isBoosted && <span className="absolute right-2 top-2 px-2 py-0.5 rounded-full bg-amber-500/90 text-[10px] font-bold text-black">Boosted</span>}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[30px] p-6 bg-white text-[#0A0A0F] flex flex-col gap-3">
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
      </section>

      {/* Trends */}
      <section className="stagger grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-[30px] p-5 sm:p-6 bg-card border border-white/[0.05] flex flex-col gap-3">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">{t.followers}</h2><span className="text-xs text-muted-foreground">30 days</span></div>
          <FollowersChart data={timeSeries} label={t.followers} />
        </div>
        <div className="rounded-[30px] p-5 sm:p-6 bg-card border border-white/[0.05] flex flex-col gap-3">
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">Engagement</h2><span className="text-xs text-muted-foreground">{t.Posts} per day vs your average</span></div>
          <EngagementChart data={timeSeries} />
        </div>
      </section>
    </div>
  );
}
