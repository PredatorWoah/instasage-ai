import { fetchAudienceData } from '@/services/api';
import { AudienceCharts } from '@/components/audience/AudienceCharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export const metadata = { title: 'Audience — InstaSage AI' };

export default async function AudiencePage() {
  const data = await fetchAudienceData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Audience</h1>
        <p className="text-sm text-muted-foreground mt-1">Demographic breakdown and activity patterns of your followers</p>
      </div>

      <AudienceCharts data={data} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Countries */}
        <Card className="bg-secondary/20 border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Top Countries</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {data.countries.slice(0, 6).map((c) => (
              <div key={c.code}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground">{c.country}</span>
                  <span className="text-xs text-muted-foreground">{c.percentage}%</span>
                </div>
                <Progress value={c.percentage} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cities */}
        <Card className="bg-secondary/20 border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Top Cities</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {data.cities.slice(0, 6).map((c) => (
              <div key={c.city}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground">
                    {c.city} <span className="text-[10px] text-muted-foreground">({c.country})</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{c.percentage}%</span>
                </div>
                <Progress value={c.percentage * 8} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Interests */}
        <Card className="bg-secondary/20 border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Audience Interests</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {data.interests.slice(0, 6).map((interest) => (
              <div key={interest.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground">{interest.category}</span>
                  <span className="text-xs text-muted-foreground">{interest.percentage}%</span>
                </div>
                <Progress value={interest.percentage} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
