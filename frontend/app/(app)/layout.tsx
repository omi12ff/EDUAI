import { Sidebar } from '@/components/layout/Sidebar';
import { AppHeader } from '@/components/layout/AppHeader';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--edu-bg)]">
      <Sidebar />

      <main className="min-w-0 flex-1 bg-[var(--edu-bg)] pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <AppHeader />

        {children}
      </main>
    </div>
  );
}
