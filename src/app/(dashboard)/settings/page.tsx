import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Settings — InstaSage AI' };

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account, connections, and preferences</p>
      </div>

      {/* Connected Accounts */}
      <Card className="bg-secondary/20 border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          {[
            { name: 'Instagram', handle: '@creatorhandle', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20', connected: true },
            { name: 'YouTube', handle: 'CreatorChannel', color: 'bg-red-500/10 text-red-400 border-red-500/20', connected: true },
            { name: 'Facebook', handle: 'Not connected', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', connected: false },
          ].map((account) => (
            <div key={account.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <Badge className={`text-[11px] border ${account.color}`}>{account.name}</Badge>
                <span className="text-xs text-muted-foreground">{account.handle}</span>
              </div>
              <Button variant={account.connected ? 'outline' : 'default'} size="sm" className="text-xs h-7">
                {account.connected ? 'Disconnect' : 'Connect'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Profile */}
      <Card className="bg-secondary/20 border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Profile</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Display Name</Label>
              <Input defaultValue="Creator Handle" className="h-8 text-sm bg-secondary/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input defaultValue="creator@example.com" className="h-8 text-sm bg-secondary/50 border-border" />
            </div>
          </div>
          <Button size="sm" className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700">Save Changes</Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-secondary/20 border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          {[
            { label: 'Weekly Performance Report', description: 'Get a weekly email summary of your stats', defaultChecked: true },
            { label: 'New AI Insights', description: 'Be notified when new insights are detected', defaultChecked: true },
            { label: 'Posting Reminders', description: 'Reminders when your optimal posting window opens', defaultChecked: false },
            { label: 'Competitor Alerts', description: 'Alerts when competitors show unusual activity', defaultChecked: false },
          ].map((n, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{n.label}</p>
                <p className="text-xs text-muted-foreground">{n.description}</p>
              </div>
              <Switch defaultChecked={n.defaultChecked} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator className="border-border" />

      {/* Danger Zone */}
      <div>
        <p className="text-xs font-semibold text-red-400 mb-3">Danger Zone</p>
        <Button variant="outline" size="sm" className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10">
          Delete Account
        </Button>
      </div>
    </div>
  );
}
