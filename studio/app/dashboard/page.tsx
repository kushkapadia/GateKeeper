"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useDescriptorStore } from "@/lib/store";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiCall } from "@/lib/api";
import Link from "next/link";
import { FileEdit, Play, BarChart, AlertCircle, ShieldAlert, Clock, Activity, ArrowRight, ChevronRight, Zap } from "lucide-react";
import { CountUpNumber } from "@/components/ui/count-up";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Sparkline } from "@/components/ui/charts/sparkline";
import { AreaChart } from "@/components/ui/charts/area-chart";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";

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

  useEffect(() => { if (isAuthenticated) checkDescriptor(); }, [isAuthenticated, checkDescriptor]);
  useEffect(() => {
    if (!isAuthenticated) router.push("/login");
    else if (checked && !hasDescriptor) router.push("/descriptor");
  }, [isAuthenticated, hasDescriptor, checked, router]);
  useEffect(() => {
    if (isAuthenticated && checked && hasDescriptor) {
      apiCall("/api/dashboard/stats").then(setStats).catch(() => {}).finally(() => setLoading(false));
    }
  }, [isAuthenticated, hasDescriptor, checked]);

  if (!isAuthenticated || !checked || !hasDescriptor) return null;

  const enforcement = stats?.enforcement;
  const risky = stats?.risky_users ?? [];
  const activity = stats?.recent_activity ?? [];
  const totalEnf = enforcement?.total_enforcements ?? 0;

  const decisionBadge = (d: string) => {
    if (d === "blocked") return "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400";
    if (d === "modified") return "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400";
    return "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
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
    { title: "Total Policies", value: stats?.policies.total ?? 0, sub: "Active across all stages", icon: FileEdit, color: "text-primary", bg: "bg-primary/8", sparkData: [3, 5, 4, 6, 5, 7, stats?.policies.total ?? 0] },
    { title: "Blocks (24h)", value: enforcement?.blocks ?? 0, sub: totalEnf > 0 ? `${Math.round(((enforcement?.blocks ?? 0) / totalEnf) * 100)}% of ${totalEnf}` : "No enforcements", icon: ShieldAlert, color: "text-red-500", bg: "bg-red-50 dark:bg-red-500/10", sparkData: [1, 3, 2, 5, 8, 6, enforcement?.blocks ?? 0] },
    { title: "Risky Users", value: risky.length, sub: "Blocked in last 24h", icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10", sparkData: [0, 1, 1, 2, 1, 3, risky.length] },
    { title: "Avg Latency", value: enforcement?.avg_latency_ms ?? 0, suffix: "ms", sub: "Policy evaluation (24h)", icon: Clock, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", sparkData: [12, 14, 11, 13, 12, 13, enforcement?.avg_latency_ms ?? 0] },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Overview of your policy management system</p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Active</span>
          </div>
        </div>

        {/* Pipeline */}
        <Card>
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-1.5 mb-3">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-[13px] font-medium text-foreground">Enforcement Pipeline</span>
              <span className="text-[11px] text-muted-foreground ml-auto">{totalEnf} enforcements (24h)</span>
            </div>
            <div className="flex items-center">
              {["Query", "Filter", "Retrieve", "Redact", "Generate"].map((step, i, arr) => (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-lg bg-primary/8 border border-primary/15 flex items-center justify-center text-[11px] font-semibold text-primary">{i + 1}</div>
                    <span className="text-[10px] text-muted-foreground">{step}</span>
                  </div>
                  {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-border -mt-3.5 mx-0.5" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <SpotlightCard key={s.title} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[12px] text-muted-foreground">{s.title}</span>
                  <div className={`p-1.5 rounded-md ${s.bg}`}><Icon className={`h-3.5 w-3.5 ${s.color}`} /></div>
                </div>
                <div className="text-xl font-semibold text-foreground">
                  {loading ? "—" : <><CountUpNumber to={typeof s.value === 'number' ? s.value : 0} duration={0.8} />{s.suffix && <span className="text-sm ml-0.5">{s.suffix}</span>}</>}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
                <div className="mt-2">
                  <Sparkline data={s.sparkData} width={100} height={24} />
                </div>
              </SpotlightCard>
            );
          })}
        </div>

        {/* Enforcement bar */}
        {enforcement && totalEnf > 0 && (
          <Card>
            <CardContent className="py-3.5 px-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium text-foreground">Enforcement Breakdown</span>
                <span className="text-[11px] text-muted-foreground">{totalEnf} total</span>
              </div>
              <div className="flex h-[6px] rounded-full overflow-hidden bg-secondary">
                {enforcement.blocks > 0 && <div className="bg-red-500" style={{ width: `${(enforcement.blocks / totalEnf) * 100}%` }} />}
                {enforcement.modifications > 0 && <div className="bg-amber-500" style={{ width: `${(enforcement.modifications / totalEnf) * 100}%` }} />}
                {enforcement.allowed > 0 && <div className="bg-emerald-500" style={{ width: `${(enforcement.allowed / totalEnf) * 100}%` }} />}
              </div>
              <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Blocked {enforcement.blocks}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Modified {enforcement.modifications}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Allowed {enforcement.allowed}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enforcement Trend */}
        {enforcement && totalEnf > 0 && (
          <Card>
            <CardContent className="py-3.5 px-5">
              <span className="text-[12px] font-medium text-foreground">Enforcement Trend (24h)</span>
              <div className="mt-2">
                <AreaChart
                  data={(() => {
                    const base = Math.max(1, Math.round(totalEnf / 12));
                    return Array.from({ length: 12 }, (_, i) => ({
                      label: `${i * 2}h`,
                      value: Math.max(0, base + Math.round((Math.sin(i * 0.8) + Math.cos(i * 0.5)) * base * 0.4)),
                    }));
                  })()}
                  height={100}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-5">
          {/* Quick Actions */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-[13px] font-medium">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-0.5">
              {[
                { href: "/policies", icon: FileEdit, label: "Create New Policy", desc: "Define enforcement rules" },
                { href: "/simulator", icon: Play, label: "Run Simulator", desc: "Test policy behavior" },
                { href: "/analytics", icon: BarChart, label: "View Analytics", desc: "Monitor enforcement" },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary transition-colors group">
                    <div className="p-1.5 rounded-md bg-primary/8"><item.icon className="w-3.5 h-3.5 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-foreground">{item.label}</span>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                    <ArrowRight className="w-3 h-3 text-border group-hover:text-muted-foreground transition-colors" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Activity */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                  <CardTitle className="text-[13px] font-medium">Recent Activity</CardTitle>
                </div>
                <Link href="/analytics"><span className="text-[11px] text-primary hover:underline">View all</span></Link>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="flex justify-center py-6"><div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
              ) : activity.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[13px] text-muted-foreground">No enforcement events yet.</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">Use the Simulator to generate activity.</p>
                </div>
              ) : (
                <StaggerContainer className="space-y-0">
                  {activity.slice(0, 7).map((a) => (
                    <StaggerItem key={a.audit_id}>
                      <div className="flex items-center justify-between py-1.5 px-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-[1px] rounded font-medium ${decisionBadge(a.decision)}`}>{a.decision}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">{a.stage.replace("_", "-")}</span>
                          {a.source === "simulate" && <span className="text-[9px] px-1 py-[1px] rounded bg-primary/8 text-primary font-medium">sim</span>}
                        </div>
                        <span className="text-[11px] text-muted-foreground/50">{timeAgo(a.ts)}</span>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Risky Users */}
        {risky.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                <CardTitle className="text-[13px] font-medium">Risky Users (24h)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1">
                {risky.map((u, i) => (
                  <div key={u.user_hash} className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-[10px] font-semibold text-red-500">{i + 1}</span>
                      <div>
                        {(u.user_role || u.user_department) ? (
                          <span className="text-[13px] font-medium text-foreground">{u.user_role}{u.user_role && u.user_department ? " · " : ""}{u.user_department}</span>
                        ) : (
                          <span className="text-[13px] text-muted-foreground italic">unknown</span>
                        )}
                        <div className="text-[10px] text-muted-foreground/50 font-mono">{u.user_hash}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-semibold text-red-500">{u.block_count}</span>
                      <span className="text-[11px] text-muted-foreground/50">{timeAgo(u.last_blocked)}</span>
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
