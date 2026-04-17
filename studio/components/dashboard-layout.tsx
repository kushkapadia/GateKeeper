"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useTheme } from "@/components/theme-provider";
import Link from "next/link";
import { LogOut, Home, FileEdit, Play, BarChart, TestTube, Database, Shield, Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);
  const tenant = useAuthStore((state) => state.tenant);
  const tenantName = tenant?.name;
  const { theme, toggleTheme } = useTheme();

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
    { href: "/descriptor", label: "Schema", icon: Database },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 w-[220px] flex flex-col bg-sidebar border-r border-sidebar-border">
        {/* Brand */}
        <div className="flex items-center gap-2 px-4 h-[52px] border-b border-sidebar-border">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[13px] font-semibold text-foreground">GateKeeper</span>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] transition-colors ${
                  isActive
                    ? "text-primary font-medium"
                    : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-hover"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-md bg-primary/8"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-sidebar-muted"}`} />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="px-2 py-2 space-y-0.5 border-t border-sidebar-border">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 px-2.5 py-[7px] rounded-md text-[13px] text-sidebar-foreground hover:text-foreground hover:bg-sidebar-hover transition-colors"
          >
            {theme === "dark" ? <Sun className="w-[15px] h-[15px]" /> : <Moon className="w-[15px] h-[15px]" />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <div className="flex items-center justify-between px-2.5 py-[7px]">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary uppercase">
                {tenantName?.charAt(0) || "T"}
              </div>
              <span className="text-[12px] text-foreground truncate max-w-[110px]">{tenantName || "Tenant"}</span>
            </div>
            <button onClick={handleLogout} className="p-1 rounded text-sidebar-muted hover:text-foreground transition-colors" title="Logout">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-[220px]">
        <div className="max-w-[1200px] mx-auto px-6 py-5">
          {children}
        </div>
      </main>
    </div>
  );
}
