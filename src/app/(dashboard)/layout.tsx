import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { AIChat } from '@/components/ai-assistant/AIChat';
import { AuthGuard } from '@/components/layout/AuthGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <TopNav />
        <main className="lg:pl-[240px] pt-16 min-h-screen">
          <div className="p-6 max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
        <AIChat />
      </div>
    </AuthGuard>
  );
}
