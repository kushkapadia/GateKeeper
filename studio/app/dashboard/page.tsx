"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useDescriptorStore } from "@/lib/store";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiCall } from "@/lib/api";
import Link from "next/link";
import { FileEdit, Play, BarChart, AlertCircle, ShieldAlert, Clock, Activity, ArrowRight } from "lucide-react";

interface DashboardStats {
  policies: { total: number };
  enforcement: {
    total_enforcements: number;
    blocks: number;
    modifications: number;
    allowed: number;
    avg_latency_ms: number;
  };
  risky_users: { user_hash: string; block_count: number; last_blocked: string | null; user_role?: string; user_department?: string }[];
  recent_activity: {
    audit_id: string;
    ts: string | null;
    stage: string;
    decision: string;
    user_hash: string;
    policies_fired: number;
    source?: string;
  }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasDescriptor = useDescriptorStore((state) => state.hasDescriptor);
  const checked = useDescriptorStore((state) => state.checked);
  const checkDescriptor = useDescriptorStore((state) => state.checkDescriptor);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      checkDescriptor();
    }
  }, [isAuthenticated, checkDescriptor]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    } else if (checked && !hasDescriptor) {
      router.push("/descriptor");
    }
  }, [isAuthenticated, hasDescriptor, checked, router]);

  useEffect(() => {
    if (isAuthenticated && checked && hasDescriptor) {
      apiCall("/api/dashboard/stats")
        .then(setStats)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated, hasDescriptor, checked]);

  if (!isAuthenticated || !checked || !hasDescriptor) return null;

  const enforcement = stats?.enforcement;
  const risky = stats?.risky_users ?? [];
  const activity = stats?.recent_activity ?? [];

  const decisionBadge = (d: string) => {
    if (d === "blocked") return "bg-red-500/10 text-red-600 ring-1 ring-red-500/20";
    if (d === "modified") return "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20";
    return "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20";
  };

  const timeAgo = (iso: string | null) => {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const statCards = [
    {
      title: "Total Policies",
      value: stats?.policies.total ?? 0,
      subtitle: "Active across all stages",
      icon: FileEdit,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      title: "Blocks (24h)",
      value: enforcement?.blocks ?? 0,
      subtitle: enforcement && enforcement.total_enforcements > 0
        ? `${Math.round((enforcement.blocks / enforcement.total_enforcements) * 100)}% of ${enforcement.total_enforcements} total`
        : "No enforcements yet",
      icon: ShieldAlert,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Risky Users",
      value: risky.length,
      subtitle: "Blocked in last 24h",
      icon: AlertCircle,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Avg Latency",
      value: `${enforcement?.avg_latency_ms ?? 0}ms`,
      subtitle: "Policy evaluation (24h avg)",
      icon: Clock,
      color: "text-slate-600",
      bg: "bg-slate-100",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of your policy management system</p>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.title}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-600">{s.title}</span>
                    <div className={`p-2 rounded-lg ${s.bg}`}>
                      <Icon className={`h-4 w-4 ${s.color}`} />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{loading ? "…" : s.value}</div>
                  <p className="text-xs text-slate-500 mt-1">{s.subtitle}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* ── Quick Actions ───────────────────────────────── */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-slate-900">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { href: "/policies", icon: FileEdit, label: "Create New Policy", desc: "Define enforcement rules" },
                { href: "/simulator", icon: Play, label: "Run Simulator", desc: "Test policy behavior" },
                { href: "/analytics", icon: BarChart, label: "View Analytics", desc: "Monitor enforcement trends" },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* ── Recent Activity ─────────────────────────────── */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-400" />
                <CardTitle className="text-base font-semibold text-slate-900">Recent Activity</CardTitle>
              </div>
              <CardDescription>Latest enforcement events</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : activity.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-400">No enforcement events yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Use the Simulator to generate activity.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activity.map((a) => (
                    <div key={a.audit_id} className="flex items-center justify-between text-sm py-2 px-2 rounded-lg hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${decisionBadge(a.decision)}`}>
                          {a.decision}
                        </span>
                        <span className="text-slate-500 text-xs">{a.stage.replace("_", "-")}</span>
                        {a.source === "simulate" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-500 font-medium ring-1 ring-indigo-500/20">sim</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{timeAgo(a.ts)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Risky Users ──────────────────────────────────── */}
        {risky.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <CardTitle className="text-base font-semibold text-slate-900">Risky Users (24h)</CardTitle>
              </div>
              <CardDescription>Users with the most blocked requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {risky.map((u, i) => (
                  <div key={u.user_hash} className="flex items-center justify-between text-sm p-3 rounded-lg bg-slate-50/80 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">
                        {i + 1}
                      </span>
                      <div>
                        {(u.user_role || u.user_department) ? (
                          <span className="font-medium text-slate-700">
                            {u.user_role}{u.user_role && u.user_department ? " · " : ""}{u.user_department}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">unknown user</span>
                        )}
                        <div className="font-mono text-[11px] text-slate-400">{u.user_hash}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-red-600 font-semibold text-sm">{u.block_count} blocks</span>
                      <span className="text-xs text-slate-400">{timeAgo(u.last_blocked)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
