import { SiteHeader } from '@/components/layout/SiteHeader';
import { HealthBanner } from '@/components/layout/HealthBanner';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { AIChat } from '@/components/ai-assistant/AIChat';
import { PageTransition } from '@/components/layout/PageTransition';
import { Guard } from '@/components/ui/Guard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <div className="min-h-screen bg-background">
        {/* Colour behind the glass: slow blobs, softer in the light theme */}
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden glass-backdrop">
          <div className="glass-blob glass-blob-a -top-40 -left-32 w-[520px] h-[520px] bg-[radial-gradient(circle_at_35%_35%,#FF7AB0,#FF2E7E_60%,transparent)] opacity-40" />
          <div className="glass-blob glass-blob-b top-1/3 -right-40 w-[560px] h-[560px] bg-[radial-gradient(circle_at_35%_35%,#8FA2FF,#3D5AFE_60%,transparent)] opacity-40" />
          <div className="glass-blob glass-blob-a -bottom-48 left-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle_at_35%_35%,#E4FF7A,#B6F01F_60%,transparent)] opacity-20" />
        </div>
        <SiteHeader />
        <Guard name="HealthBanner"><HealthBanner /></Guard>
        <Guard name="CommandPalette"><CommandPalette /></Guard>
        {/* Extra room at the bottom on phones so the Sage button never covers the last item */}
        <main className="relative max-w-[1480px] mx-auto px-4 sm:px-6 pt-6 pb-24 sm:py-8">
          <PageTransition>{children}</PageTransition>
        </main>
        <Guard name="AIChat"><AIChat /></Guard>
      </div>
  );
}
