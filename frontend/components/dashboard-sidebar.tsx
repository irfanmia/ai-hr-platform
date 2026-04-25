"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, ClipboardList, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

import { BrandWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { clearHr } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/applications", label: "Applications", icon: ClipboardList },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function handleLogout() {
    clearHr();
    router.push("/admin-login");
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200">Recruiter Console</p>
          <div className="mt-2">
            <BrandWordmark size="md" inverse hideTld />
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          className="ml-2 rounded-lg p-1.5 text-indigo-200 hover:bg-ink-800 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="space-y-1.5">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                isActive ? "bg-white text-indigo-950" : "text-indigo-100 hover:bg-ink-800"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <Button
        variant="outline"
        className="mt-auto border-indigo-400 bg-transparent text-white hover:bg-ink-800"
        onClick={handleLogout}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-ink-900 px-4 py-3 text-white lg:hidden">
        <div>
          <p className="text-xs font-medium text-indigo-300">Recruiter Console</p>
          <BrandWordmark size="sm" inverse hideTld />
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-indigo-200 hover:bg-ink-800"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* ── Mobile overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-72 bg-ink-900 px-5 py-6 text-white transition-transform duration-300 lg:hidden",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden min-h-screen w-72 shrink-0 flex-col bg-ink-900 px-5 py-6 text-white lg:flex">
        <SidebarContent />
      </aside>
    </>
  );
}
