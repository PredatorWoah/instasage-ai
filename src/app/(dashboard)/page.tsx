import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDashboardData } from '@/services/dashboard';
import { KPIGrid } from '@/components/dashboard/KPIGrid';
import { RecentContent } from '@/components/dashboard/RecentContent';
import { FollowersChart } from '@/components/charts/FollowersChart';
import { ViewsChart } from '@/components/charts/ViewsChart';
import { EngagementChart } from '@/components/charts/EngagementChart';
import { PostingFrequencyChart } from '@/components/charts/PostingFrequencyChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/utils/formatters';
import type { KPIMetric, TimeSeriesPoint } from '@/types';
import { generateInsights } from '@/services/ai';

export const metadata = {
  title: 'Dashboard — InstaSage AI',
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/login');
  }

  const data = await getDashboardData(session.user.id);
  const insightsData = await generateInsights(session.user.id);

  const metricsData: KPIMetric[] = [
    {
      id: 'followers',
      label: 'Total Followers',
      value: formatNumber(data.kpis.followers),
      change: '+0',
      changePercent: 0,
      trend: 'neutral' as const,
      icon: 'Users',
      color: 'bg-indigo-500/10 text-indigo-500'
    },
    {
      id: 'views',
      label: 'Total Views',
      value: formatNumber(data.kpis.views),
      change: '+0',
      changePercent: 0,
      trend: 'neutral' as const,
      icon: 'Eye',
      color: 'bg-emerald-500/10 text-emerald-500'
    },
    {
      id: 'engagement',
      label: 'Avg Engagement',
      value: `${data.kpis.engagement.toFixed(1)}%`,
      change: '+0',
      changePercent: 0,
      trend: 'neutral' as const,
      icon: 'Heart',
      color: 'bg-pink-500/10 text-pink-500'
    },
  ];

  // Map historical database metrics to chart TimeSeriesPoint format
  const timeseriesMap = new Map<string, TimeSeriesPoint>();

  // Initialize last 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    timeseriesMap.set(dateStr, {
      date: dateStr,
      followers: 0,
      views: 0,
      engagement: 0,
      posts: 0
    });
  }

  // Populate actual data
  data.metrics.forEach(m => {
    const dStr = m.date.toISOString().split('T')[0];
    if (timeseriesMap.has(dStr)) {
      const existing = timeseriesMap.get(dStr)!;
      existing.followers = (existing.followers || 0) + (m.followers || 0);
      existing.views = (existing.views || 0) + (m.views || 0);
      existing.posts = (existing.posts || 0) + (m.postsCount || 0);
      // Rough avg
      existing.engagement = ((existing.engagement || 0) + (m.engagement || 0)) / 2;
    }
  });

  const timeSeriesData = Array.from(timeseriesMap.values());

  const filteredInsights = Array.isArray(insightsData) ? insightsData.slice(0, 2) : [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your performance across all platforms — last 30 days
        </p>
      </div>

      {/* KPI Grid */}
      <KPIGrid metrics={metricsData} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Followers Growth" subtitle="All platforms · 30 days">
          <FollowersChart data={timeSeriesData} />
        </ChartCard>
        <ChartCard title="Total Views" subtitle="All platforms · 30 days">
          <ViewsChart data={timeSeriesData} />
        </ChartCard>
        <ChartCard title="Engagement Rate" subtitle="% · 30 days">
          <EngagementChart data={timeSeriesData} />
        </ChartCard>
        <ChartCard title="Posting Frequency" subtitle="Posts per day · 30 days">
          <PostingFrequencyChart data={timeSeriesData} />
        </ChartCard>
      </div>

      {/* AI Insights Quick Panel */}
      {filteredInsights.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-foreground">
                Top AI Insights
              </h2>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground" asChild>
              <Link href="/insights">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredInsights.map((insight: any, i: number) => (
              <Card key={i} className="bg-secondary/20 border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-sm font-semibold leading-snug">{insight.title}</h3>
                    <Badge className="shrink-0 text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/20">
                      {insight.impact === 'high' ? 'High Impact' : `${insight.impact} Impact`}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Recent Content */}
      <RecentContent posts={data.posts.map(p => ({
          id: p.id,
          type: p.type as any,
          platform: p.platform as any,
          thumbnail: p.thumbnail,
          caption: p.caption,
          views: p.views,
          likes: p.likes,
          comments: p.comments,
          shares: p.shares,
          saves: p.saves,
          performanceScore: p.performanceScore,
          publishedAt: p.publishedAt.toISOString()
        }))} />
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-secondary/20 border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {children}
      </CardContent>
    </Card>
  );
}
