import { fetchKPIs, fetchFollowersTimeSeries, fetchViewsTimeSeries, fetchEngagementTimeSeries, fetchPostingFrequency, fetchRecentPosts, fetchInsights } from '@/services/api';
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

export const metadata = {
  title: 'Dashboard — InstaSage AI',
};

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

  const [kpis, followersData, viewsData, engagementData, postingData, posts, insights] =
    await Promise.all([
      fetchKPIs(),
      fetchFollowersTimeSeries(),
      fetchViewsTimeSeries(),
      fetchEngagementTimeSeries(),
      fetchPostingFrequency(),
      fetchRecentPosts(8),
      fetchInsights(),
    ]);

  // Filter based on global search query
  const query = q?.toLowerCase() || '';

  const filteredInsights = insights
    .filter((i) => {
      if (!query) return i.impact === 'high';
      return i.title.toLowerCase().includes(query) || i.description.toLowerCase().includes(query);
    })
    .slice(0, 2);

  const filteredPosts = posts.filter((p) => {
    if (!query) return true;
    return p.caption.toLowerCase().includes(query);
  });

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
      <KPIGrid metrics={kpis} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Followers Growth" subtitle="All platforms · 30 days">
          <FollowersChart data={followersData.slice(-30)} />
        </ChartCard>
        <ChartCard title="Total Views" subtitle="All platforms · 30 days">
          <ViewsChart data={viewsData.slice(-30)} />
        </ChartCard>
        <ChartCard title="Engagement Rate" subtitle="% · 30 days · avg 6.8%">
          <EngagementChart data={engagementData.slice(-30)} />
        </ChartCard>
        <ChartCard title="Posting Frequency" subtitle="Posts per day · 30 days">
          <PostingFrequencyChart data={postingData.slice(-30)} />
        </ChartCard>
      </div>

      {/* AI Insights Quick Panel */}
      {filteredInsights.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-foreground">
                {query ? 'Filtered AI Insights' : 'Top AI Insights'}
              </h2>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground" asChild>
              <Link href="/insights">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredInsights.map((insight) => (
              <Card key={insight.id} className="bg-secondary/20 border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-sm font-semibold leading-snug">{insight.title}</h3>
                    <Badge className="shrink-0 text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/20">
                      {insight.impact === 'high' ? 'High Impact' : `${insight.impact} Impact`}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                  {insight.metricValue && (
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 text-xs px-2 py-1 rounded-md border border-indigo-500/20">
                      <span className="font-bold">{insight.metricValue}</span>
                      <span>{insight.metric}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Recent Content */}
      <RecentContent posts={filteredPosts} />
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
