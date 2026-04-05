"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, ClipboardList, LayoutDashboard, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/applications", label: "Applications", icon: ClipboardList },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("hr_access_token");
    localStorage.removeItem("hr_refresh_token");
    router.push("/login");
  }

  return (
    <aside className="flex min-h-screen w-full max-w-72 flex-col bg-indigo-950 px-5 py-6 text-white">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200">Recruiter Console</p>
        <h2 className="mt-2 text-2xl font-semibold">AI HR Platform</h2>
      </div>
      <nav className="space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                pathname === link.href ? "bg-white text-indigo-950" : "text-indigo-100 hover:bg-indigo-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <Button variant="outline" className="mt-auto border-indigo-400 bg-transparent text-white hover:bg-indigo-900" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </aside>
  );
}
