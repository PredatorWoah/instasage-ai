import { fetchCompetitors } from '@/services/api';
import Image from 'next/image';
import { formatNumber, formatPercent, getPlatformColor, getPlatformLabel } from '@/utils/formatters';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Competitors — InstaSage AI' };

export default async function CompetitorsPage() {
  const competitors = await fetchCompetitors();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Competitors</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track competitor growth, engagement, and content strategy
        </p>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-secondary/20">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Creator</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Platform</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Followers</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Growth</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Engagement</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Posts/Wk</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Avg Views</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Top Content</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {competitors.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                  {/* Creator */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0">
                        <Image src={c.avatar} alt={c.name} fill className="object-cover" unoptimized />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.handle}</p>
                      </div>
                    </div>
                  </td>
                  {/* Platform */}
                  <td className="px-4 py-3">
                    <Badge className={cn('text-[10px] border', getPlatformColor(c.platform))}>
                      {getPlatformLabel(c.platform)}
                    </Badge>
                  </td>
                  {/* Followers */}
                  <td className="px-4 py-3 text-right text-xs font-medium">
                    {formatNumber(c.followers)}
                  </td>
                  {/* Growth */}
                  <td className="px-4 py-3 text-right">
                    <div className={cn('inline-flex items-center gap-1 text-xs font-medium', c.followersGrowth >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {c.followersGrowth >= 0
                        ? <TrendingUp className="w-3.5 h-3.5" />
                        : <TrendingDown className="w-3.5 h-3.5" />
                      }
                      {formatPercent(c.followersGrowth)}
                    </div>
                  </td>
                  {/* Engagement */}
                  <td className="px-4 py-3 text-right text-xs font-medium">
                    {c.engagementRate}%
                  </td>
                  {/* Posts/Wk */}
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {c.postsPerWeek}
                  </td>
                  {/* Avg Views */}
                  <td className="px-4 py-3 text-right text-xs font-medium text-foreground">
                    {formatNumber(c.avgViews)}
                  </td>
                  {/* Top Content */}
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-[10px]">{c.topContentType}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
