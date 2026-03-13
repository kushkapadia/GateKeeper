"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuthStore, useDescriptorStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogOut, Home, FileEdit, Play, BarChart, TestTube, Settings, Shield } from "lucide-react";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);
  const tenant = useAuthStore((state) => state.tenant);
  const tenantName = tenant?.name;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/policies", label: "Policies", icon: FileEdit },
    { href: "/simulator", label: "Simulator", icon: Play },
    { href: "/analytics", label: "Analytics", icon: BarChart },
    { href: "/tests", label: "Test Suites", icon: TestTube },
    { href: "/descriptor", label: "Schema", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50/80">
      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-slate-300">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-white/10">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500 text-white">
            <Shield className="w-4.5 h-4.5" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">GateKeeper</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-indigo-500/20 text-white shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${isActive ? "text-indigo-400" : ""}`} />
                {item.label}
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Tenant footer */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300 uppercase">
                {tenantName?.charAt(0) || "T"}
              </div>
              <span className="text-sm text-slate-300 truncate">{tenantName || "Tenant"}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="flex-1 ml-64">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
