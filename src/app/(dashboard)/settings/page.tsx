import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { ConnectedAccounts } from '@/components/accounts/ConnectedAccounts';
import { DeleteAccountButton } from '@/components/accounts/DeleteAccountButton';
import { AiSettings } from '@/components/settings/AiSettings';
import { TimezoneSettings } from '@/components/settings/TimezoneSettings';
import { AiUsageCard } from '@/components/settings/AiUsageCard';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { NotificationSettings } from '@/components/settings/NotificationSettings';

export const metadata = { title: 'Settings · InstaSage' };

// Most used first; the chips at the top jump straight to a section
const SECTIONS = [
  { id: 'ai', label: 'AI' },
  { id: 'usage', label: 'Usage' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'timezone', label: 'Timezone' },
  { id: 'danger', label: 'Delete' },
];

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border scroll-mt-28" id={id}>
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="px-5 pb-5">{children}</CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[34px] sm:text-[44px] leading-none tracking-[-0.045em]">Settings</h1>
        <p className="text-[15px] text-muted-foreground mt-3">
          Manage your AI, connections and preferences. Your name and bio live on the <Link href="/account" className="text-indigo-400 hover:underline">Profile page</Link>.
        </p>
      </div>

      <nav aria-label="Settings sections" className="sticky top-[72px] z-20 -mx-4 px-4 sm:mx-0 sm:px-0 py-2 bg-background/80 backdrop-blur-xl">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="shrink-0 h-8 px-3 inline-flex items-center rounded-full bg-ink/[0.05] border border-ink/[0.08] text-[12px] font-bold text-muted-foreground hover:text-foreground hover:bg-ink/[0.09]">
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <Section id="ai" title="AI models" subtitle="Pick the brain behind Insights, the Ideas Studio, reports and Sage. Add as many keys as you like; the active one answers.">
        <AiSettings />
      </Section>

      <Section id="usage" title="AI usage, last 30 days">
        <AiUsageCard />
      </Section>

      <Section id="accounts" title="Connected accounts">
        <ConnectedAccounts />
      </Section>

      <Section id="notifications" title="Notifications" subtitle="Sent after the daily sync each morning. Turn them on separately on each phone or computer.">
        <NotificationSettings />
      </Section>

      <Section id="appearance" title="Appearance" subtitle="Saved in this browser. Press Ctrl+K (Cmd+K on Mac) anywhere to jump around or switch themes.">
        <ThemePicker />
      </Section>

      <Section id="timezone" title="Timezone">
        <TimezoneSettings />
      </Section>

      <Separator className="border-border" />

      <div id="danger" className="scroll-mt-28">
        <p className="text-xs font-semibold text-red-400 mb-3">Danger Zone</p>
        <DeleteAccountButton />
      </div>
    </div>
  );
}
