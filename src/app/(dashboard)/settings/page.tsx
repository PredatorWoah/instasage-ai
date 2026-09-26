import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { ConnectedAccounts } from '@/components/accounts/ConnectedAccounts';
import { DeleteAccountButton } from '@/components/accounts/DeleteAccountButton';
import { AiSettings } from '@/components/settings/AiSettings';
import { TimezoneSettings } from '@/components/settings/TimezoneSettings';

export const metadata = { title: 'Settings — InstaSage AI' };

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">Settings</h1>
        <p className="text-[15px] text-muted-foreground mt-3">Manage your account, connections, and preferences</p>
      </div>

      {/* Connected Accounts */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <ConnectedAccounts />
        </CardContent>
      </Card>

      {/* AI */}
      <Card className="bg-card border-border" id="ai">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">AI models</CardTitle>
          <p className="text-xs text-muted-foreground">Pick the brain behind Insights, the Ideas Studio, reports and Sage. Add as many keys as you like; the active one answers.</p>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <AiSettings />
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card className="bg-card border-border" id="timezone">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Timezone</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <TimezoneSettings />
        </CardContent>
      </Card>

      {/* Profile */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Profile</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <p className="text-xs text-muted-foreground">
            Edit your name, username and bio on the{' '}
            <Link href="/account" className="text-indigo-400 hover:underline">Account page</Link>.
          </p>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          {[
            { label: 'Weekly Performance Report', description: 'Get a weekly email summary of your stats', defaultChecked: true },
            { label: 'New AI Insights', description: 'Be notified when new insights are detected', defaultChecked: true },
            { label: 'Posting Reminders', description: 'Reminders when your optimal posting window opens', defaultChecked: false },
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
        <DeleteAccountButton />
      </div>
    </div>
  );
}
