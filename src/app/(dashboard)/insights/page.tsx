import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { generateInsights } from '@/services/ai';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';

export const metadata = { title: 'AI Insights — InstaSage AI' };

export default async function InsightsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) redirect('/login');

  const insights = await generateInsights(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">AI Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">Smart analysis of your content performance</p>
      </div>

      <div className="grid gap-4">
        {insights.map((insight: any, i: number) => (
          <Card key={i} className="bg-secondary/20 border-border">
            <CardContent className="p-5 flex gap-4">
              <div className="w-10 h-10 shrink-0 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold">{insight.title}</h3>
                  <Badge variant="outline" className="text-[10px]">{insight.impact} Impact</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{insight.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
