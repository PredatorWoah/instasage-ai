import { SiteHeader } from '@/components/layout/SiteHeader';
import { AIChat } from '@/components/ai-assistant/AIChat';
import { PageTransition } from '@/components/layout/PageTransition';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <div className="min-h-screen bg-background">
        {/* Ambient Prism light behind everything */}
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-64 left-1/3 w-[900px] h-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(123,97,255,0.16),transparent)]" />
          <div className="absolute top-1/2 -right-64 w-[700px] h-[700px] rounded-full bg-[radial-gradient(closest-side,rgba(255,95,143,0.08),transparent)]" />
        </div>
        <SiteHeader />
        <main className="relative max-w-[1480px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <PageTransition>{children}</PageTransition>
        </main>
        <AIChat />
      </div>
  );
}
