import { Swords } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: 'Competitors — InstaSage AI' };

export default function CompetitorsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Competitors</h1>
        <p className="text-sm text-muted-foreground mt-1">Compare other accounts with yours</p>
      </div>

      <Card className="bg-secondary/20 border-border">
        <CardContent className="p-5 flex gap-4">
          <div className="w-10 h-10 shrink-0 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <Swords className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p className="text-foreground font-medium">Not available with your current Instagram connection</p>
            <p>
              Looking up other accounts&apos; followers and posts needs Meta&apos;s Business Discovery API. Meta only offers it
              to apps that use Facebook Login with an Instagram account linked to a Facebook Page, not the Instagram Login
              token InstaSage uses.
            </p>
            <p>
              Rather than show made-up rivals, this page stays empty until that connection is added.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
