import { AuthGuard } from "@/components/auth-guard";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-slate-50">
        <DashboardSidebar />
        {/* pt-16 on mobile for fixed top bar, 0 on desktop */}
        <main className="flex-1 px-4 py-6 pt-20 lg:px-6 lg:py-8 lg:pt-8 min-w-0">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
