import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAccountScope } from '@/lib/scope';
import { getTimeZone } from '@/lib/api';
import { formatLabel, terms } from '@/lib/platform';
import { PostThumb } from '@/components/dashboard/PostThumb';
import { getDashboardData } from '@/services/dashboard';
import { postVerdicts } from '@/services/ai';
import { sageFeed, type FeedItem } from '@/services/feed';
import { SageFeed } from '@/components/dashboard/SageFeed';
import { NextMoveCard } from '@/components/dashboard/NextMoveCard';
import { AskSageButton } from '@/components/dashboard/AskSageButton';
import { FlipCard } from '@/components/content/FlipCard';
import { BestTimeTile } from '@/components/dashboard/BestTimeTile';
import { formatAge, formatNumber } from '@/utils/formatters';
import { SyncNowButton } from '@/components/dashboard/SyncNowButton';
import { SinceLastVisit } from '@/components/dashboard/SinceLastVisit';
import { GoalCard } from '@/components/dashboard/GoalCard';
import { SetupChecklist } from '@/components/dashboard/SetupChecklist';
import { followersPerDay, goalForecast, type Goal } from '@/lib/goal';
import { prisma } from '@/lib/prisma';
import { Guard } from '@/components/ui/Guard';
import { periodPhrase } from '@/lib/period';
import { nowMs } from '@/lib/calendar';
import { AutoReview } from '@/components/dashboard/AutoReview';

export const metadata = { title: 'Overview' };

// "Sun 21 Sep, 7:30 pm" in the creator's timezone
const formatPosted = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(d);

const plural = (type: string) => (type === 'post' ? 'photos' : `${type}s`);

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) redirect('/login');
  const userId = session.user.id;

  const [scope, timeZone] = await Promise.all([getAccountScope(userId), getTimeZone(userId)]);
  const now = nowMs();
  const windowStart = new Date(now - scope.span * 86_400_000);
  const [data, owner, feed, organic, byType] = await Promise.all([
    getDashboardData(scope, scope.span, timeZone),
    prisma.user.findUnique({ where: { id: userId }, select: { goal: true } }),
    sageFeed(userId, scope).catch((error) => {
      console.error('Sage feed failed:', error);
      return [] as FeedItem[];
    }),
    prisma.post.aggregate({ where: { socialProfileId: { in: scope.profileIds }, isBoosted: false }, _avg: { performanceScore: true } }),
    prisma.post.groupBy({ by: ['type'], where: { socialProfileId: { in: scope.profileIds }, publishedAt: { gte: windowStart } }, _sum: { views: true, saves: true }, _count: true }),
  ]);

  const { kpis, timeSeries } = data;
  const hasData = data.profiles.length > 0;
  const t = terms(scope.mode);
  const phrase = periodPhrase(scope.days);

  // A bad goal value must never take the whole Overview down; worst case the card shows no forecast
  let forecast: ReturnType<typeof goalForecast> = null;
  try {
    forecast = goalForecast(owner?.goal as Goal | null, kpis.followers, followersPerDay(timeSeries), timeZone);
  } catch (error) {
    console.error('Goal forecast failed:', error, owner?.goal);
  }

  // ---- 1. The latest post ----
  const latest = data.posts[0];
  const cards = data.posts.slice(0, 4);
  const [verdicts, before] = await Promise.all([
    postVerdicts(userId, cards.map((p) => p.id)).catch(() => ({} as Awaited<ReturnType<typeof postVerdicts>>)),
    // Its views about a day ago, for "+N since yesterday"
    latest
      ? prisma.postSnapshot.findFirst({ where: { postId: latest.id, takenAt: { lte: new Date(now - 20 * 3_600_000) } }, orderBy: { takenAt: 'desc' }, select: { views: true } }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const ageDays = latest ? (now - latest.publishedAt.getTime()) / 86_400_000 : 0;
  const usual = kpis.avgViews;
  const ratio = latest && usual > 0 ? latest.views / usual : null;
  const beat = latest ? data.posts.slice(1, 11).filter((p) => latest.views > p.views).length : 0;
  const others = Math.min(10, Math.max(0, data.posts.length - 1));
  const gained = latest && before && latest.views > before.views ? latest.views - before.views : null;
  const yt = latest?.platform === 'youtube';
  const line = !latest
    ? ''
    : ageDays < 2 || latest.isBoosted || ratio == null
      ? ageDays < 2 ? 'views so far. Still climbing.' : 'views.'
      : ratio >= 1.5
        ? `views. That's ${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1).replace(/\.0$/, '')}× your usual.`
        : ratio >= 1
          ? `views. ${Math.round((ratio - 1) * 100)}% over your usual.`
          : `views. ${Math.round((1 - ratio) * 100)}% under your usual.`;
  const up = ratio != null && ratio >= 1 && ageDays >= 2;

  // ---- 2. Are you growing? ----
  const change = kpis.followersChange;
  const growing = change > 0 ? 'Yes.' : change < 0 ? 'Not right now.' : 'Holding steady.';
  const growLine = `${change >= 0 ? '+' : '−'}${formatNumber(Math.abs(change))} ${t.followersLower} ${scope.days == null ? 'since tracking began' : `in ${phrase}`}.${forecast && !forecast.reached ? ` ${formatNumber(forecast.remaining)} to your goal.` : forecast?.reached ? ' Goal reached.' : ''}`;

  // ---- 3. What kind of creator were you in this window ----
  const totalViews = byType.reduce((a, g) => a + (g._sum.views ?? 0), 0);
  const top = [...byType].sort((a, b) => (b._sum.views ?? 0) - (a._sum.views ?? 0))[0];
  const saver = yt ? null : [...byType].filter((g) => g._count > 0).sort((a, b) => (b._sum.saves ?? 0) / b._count - (a._sum.saves ?? 0) / a._count)[0];
  const share = top && totalViews > 0 ? Math.round(((top._sum.views ?? 0) / totalViews) * 100) : null;

  // Goal pace joins the feed, so it reads as one running story
  const feedItems: FeedItem[] = [...feed];
  if (forecast && hasData && forecast.onTrack != null && !forecast.reached) {
    feedItems.splice(Math.min(2, feedItems.length), 0, { id: 'goal', kind: 'goal', at: 0, ago: 'now', text: `Goal pace: ${forecast.onTrack ? 'on track' : 'behind'} for ${formatNumber(forecast.target)} by ${forecast.deadlineLabel}. You're gaining ${forecast.perDay ?? 0} a day, ${forecast.neededPerDay} a day needed.` });
  }

  const sync = (
    <SyncNowButton
      accounts={scope.profiles.map((p) => ({ id: p.id, username: p.username, platform: p.platform }))}
      syncedAgo={data.syncedMinutesAgo == null ? null : formatAge(data.syncedMinutesAgo)}
      stale={data.syncedMinutesAgo != null && data.syncedMinutesAgo > 24 * 60}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* The latest post, first */}
      <section className="animate-rise glass-panel rounded-[34px] p-6 sm:p-9 flex flex-col md:flex-row gap-6 md:gap-10 md:items-center">
        {latest ? (
          <>
            <Link href={`/content/${encodeURIComponent(latest.id)}`} transitionTypes={['page-fade']} aria-label={`Open your latest ${t.post}`} className={`on-color group relative shrink-0 self-start md:self-center rounded-[22px] overflow-hidden border border-white/25 bg-[linear-gradient(160deg,#8C7BFF,#FF6F91)] shadow-[0_24px_50px_-16px_rgba(0,0,0,0.55)] -rotate-3 ${yt && latest.type !== 'short' ? 'w-[220px] aspect-video' : 'w-[120px] sm:w-[190px] aspect-[9/16]'}`}>
              <PostThumb src={latest.thumbnail} type={latest.type} sizes="220px" />
            </Link>
            <div className="min-w-0 flex-1 flex flex-col gap-3">
              <p className="text-[14px] sm:text-[15px] font-bold text-foreground/80">Your latest {formatLabel(latest.type).toLowerCase()} · {formatPosted(latest.publishedAt, timeZone)}</p>
              <p className="font-display font-extrabold text-[72px] sm:text-[124px] leading-[0.85] tracking-[-0.06em] tabular-nums">{latest.views.toLocaleString('en-US')}</p>
              <p className={`font-display font-extrabold text-[26px] sm:text-[40px] leading-[1.02] tracking-[-0.03em] text-balance ${up ? 'text-emerald-400' : ''}`}>{line}</p>
              <p className="text-[15px] sm:text-[17px] font-semibold leading-snug max-w-[620px] break-words">
                <span className="line-clamp-2">&ldquo;{latest.caption.replace(/\s+/g, ' ').trim().slice(0, 110) || (yt ? 'Untitled video' : 'No caption')}&rdquo;{others >= 3 && ageDays >= 2 ? ` beat ${beat} of your last ${others} ${t.posts}.` : ''}</span>
                {verdicts[latest.id]?.verdict && <span className="block mt-1.5 text-[14px] sm:text-[15px] font-medium text-muted-foreground">Sage: {verdicts[latest.id].verdict}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {gained != null && <span className="px-4 py-2 rounded-full bg-foreground text-background text-[13px] sm:text-[14px] font-bold">+{formatNumber(gained)} since yesterday</span>}
                {!yt && <span className="px-4 py-2 rounded-full glass-field text-[13px] sm:text-[14px] font-bold">{formatNumber(latest.saves)} saves</span>}
                {!yt && <span className="px-4 py-2 rounded-full glass-field text-[13px] sm:text-[14px] font-bold">{formatNumber(latest.shares)} shares</span>}
                <span className="px-4 py-2 rounded-full glass-field text-[13px] sm:text-[14px] font-bold">{formatNumber(latest.likes)} likes</span>
                <span className="px-4 py-2 rounded-full glass-field text-[13px] sm:text-[14px] font-bold">{latest.performanceScore.toFixed(1)}% engagement</span>
                {latest.isBoosted && <span className="px-4 py-2 rounded-full bg-amber-400 text-black text-[13px] font-bold">Boosted</span>}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-1">
                <AskSageButton question={`About my latest ${latest.type} "${latest.caption.replace(/\s+/g, ' ').slice(0, 80)}" with ${latest.views} views: how is it doing against my usual, why, and what should I do next?`} />
                {sync}
              </div>
              <Guard name="SinceLastVisit"><SinceLastVisit scopeKey={scope.key} followers={kpis.followers} unit={t.followersLower} postTimes={data.posts.map((p) => p.publishedAt.toISOString())} post={t.post} posts={t.posts} /></Guard>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <h1 className="font-display font-extrabold text-[40px] sm:text-[64px] leading-[0.95] tracking-[-0.05em]">{hasData ? 'No posts synced yet.' : 'Connect Instagram or YouTube to start.'}</h1>
            {hasData ? sync : <Link href="/accounts" className="self-start h-12 px-6 rounded-full bg-foreground text-background text-[14px] font-bold inline-flex items-center">Connect an account</Link>}
          </div>
        )}
      </section>

      <Guard name="SetupChecklist"><SetupChecklist /></Guard>

      {/* Three blocks, nothing else */}
      {hasData && (
        <section className="stagger grid grid-cols-1 md:grid-cols-3 gap-4">
          <article className={`glass-tint rounded-[30px] p-6 sm:p-7 flex flex-col gap-2.5 min-h-[250px] border min-w-0 ${change < 0 ? 'bg-rose-500/15 border-rose-300/35' : 'bg-lime-400/15 border-lime-300/40'}`}>
            <span className="text-[14px] font-bold text-foreground/85">Are you growing?</span>
            <p className={`font-display font-extrabold text-[52px] sm:text-[68px] leading-[0.9] tracking-[-0.05em] ${change > 0 ? 'text-emerald-400' : change < 0 ? 'text-rose-400' : ''}`}>{growing}</p>
            <p className="text-[15px] font-semibold leading-snug">{growLine}</p>
            <p className="mt-auto text-[13px] font-semibold text-foreground/75 tabular-nums">{formatNumber(kpis.followers)} {t.followersLower} · {kpis.reach.value != null && !t.yt ? `${formatNumber(kpis.reach.value)} reached · ` : ''}{formatNumber(kpis.views)} views</p>
            <Link href="/analytics" transitionTypes={['nav-forward']} className="self-start text-[13px] font-bold underline underline-offset-4">See the growth charts</Link>
          </article>

          <Guard name="NextMoveCard"><NextMoveCard hasData={hasData} /></Guard>

          <article className="glass-tint rounded-[30px] p-6 sm:p-7 flex flex-col gap-2.5 min-h-[250px] bg-orange-400/15 border border-orange-300/40 min-w-0">
            <span className="text-[14px] font-bold text-foreground/85">{scope.days == null ? 'All time, you are' : `In ${phrase}, you were`}</span>
            {top && share != null ? (
              <>
                <p className="font-display font-extrabold text-[40px] sm:text-[46px] leading-[0.95] tracking-[-0.04em] text-amber-400">Team {formatLabel(top.type)}s.</p>
                <p className="text-[15px] font-semibold leading-snug">{share}% of your views came from {plural(top.type)}.{saver && saver.type !== top.type && (saver._sum.saves ?? 0) > 0 ? ` ${formatLabel(saver.type)}s got the saves.` : ''}</p>
                <Link href="/insights" transitionTypes={['nav-forward']} className="mt-auto self-start text-[13px] font-bold underline underline-offset-4">What else is working</Link>
              </>
            ) : (
              <p className="font-display font-extrabold text-[30px] leading-[1] tracking-[-0.04em]">Quiet. No {t.posts} in this window.</p>
            )}
          </article>
        </section>
      )}

      {/* Turn any recent post over */}
      <AutoReview pending={hasData} />
      {cards.length > 0 && (
        <section className="flex flex-col gap-3 pt-2">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h2 className="font-display font-extrabold text-[26px] sm:text-[32px] tracking-[-0.04em]">Flip a {t.post}.</h2>
            <Link href="/content" transitionTypes={['nav-forward']} className="text-[13px] font-bold underline underline-offset-4 shrink-0">All {t.posts}</Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
            {cards.map((p) => (
              <FlipCard
                key={p.id}
                now={now}
                avgViews={usual}
                avgEngagement={organic._avg.performanceScore ?? 0}
                post={{ id: p.id, type: p.type, platform: p.platform, caption: p.caption, thumbnail: p.thumbnail, views: p.views, reach: p.reach, likes: p.likes, comments: p.comments, saves: p.saves, shares: p.shares, performanceScore: p.performanceScore, publishedAt: p.publishedAt.toISOString(), isBoosted: p.isBoosted, aiVerdict: verdicts[p.id]?.verdict ?? null }}
              />
            ))}
          </div>
        </section>
      )}

      {/* What Sage has been up to, your goal and best time */}
      {hasData && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 min-w-0"><SageFeed items={feedItems} /></div>
          <div className="lg:col-span-5 flex flex-col gap-4 min-w-0">
            <Guard name="GoalCard"><GoalCard forecast={forecast} current={kpis.followers} unit={t.followersLower} perDay={followersPerDay(timeSeries)} timeZone={timeZone} /></Guard>
            <Guard name="BestTimeTile"><BestTimeTile /></Guard>
          </div>
        </section>
      )}
    </div>
  );
}
