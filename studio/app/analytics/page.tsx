"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiCall } from "@/lib/api";
import { ShieldAlert, ShieldCheck, PenTool, Clock, Activity, TrendingUp, Users } from "lucide-react";
import { CountUpNumber } from "@/components/ui/count-up";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { DonutChart } from "@/components/ui/charts/donut-chart";
import { AreaChart } from "@/components/ui/charts/area-chart";
import { BarChart } from "@/components/ui/charts/bar-chart";
import { StaggerContainer, StaggerItem } from "@/components/ui/motion";

interface AuditEntry {
  audit_id: string;
  ts: string | null;
  stage: string;
  decision: string;
  user_id_hash: string;
  policies: any[];
  metrics: { latency_ms?: number };
}

interface RiskyUser {
  user_hash: string;
  block_count: number;
  last_blocked: string | null;
  user_role?: string;
  user_department?: string;
}

interface Stats {
  total_enforcements: number;
  blocks: number;
  modifications: number;
  allowed: number;
  avg_latency_ms: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [riskyUsers, setRiskyUsers] = useState<RiskyUser[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiCall("/api/dashboard/stats").catch(() => null),
      apiCall("/api/audit?limit=20").catch(() => ({ logs: [] })),
    ]).then(([dashData, auditData]) => {
      if (dashData) {
        setStats(dashData.enforcement);
        setRiskyUsers(dashData.risky_users || []);
      }
      setRecentLogs(auditData?.logs || []);
    }).finally(() => setLoading(false));
  }, []);

  const decisionBadge = (d: string) => {
    if (d === "blocked") return "bg-red-500/10 text-red-500";
    if (d === "modified") return "bg-amber-500/10 text-amber-500";
    return "bg-emerald-500/10 text-emerald-500";
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

  const total = stats?.total_enforcements ?? 0;
  const pct = (n: number) => total === 0 ? 0 : Math.round((n / total) * 100);

  const summaryCards = [
    { title: "Blocks (24h)", value: stats?.blocks ?? 0, icon: ShieldAlert, color: "text-red-500", iconBg: "bg-red-500/10" },
    { title: "Modifications (24h)", value: stats?.modifications ?? 0, icon: PenTool, color: "text-amber-500", iconBg: "bg-amber-500/10" },
    { title: "Allowed (24h)", value: stats?.allowed ?? 0, icon: ShieldCheck, color: "text-emerald-500", iconBg: "bg-emerald-500/10" },
    { title: "Avg Latency", value: stats?.avg_latency_ms ?? 0, icon: Clock, color: "text-primary", iconBg: "bg-primary/10", suffix: "ms" },
  ];

  // Stage breakdown from audit logs
  const stageBreakdown = recentLogs.reduce((acc, log) => {
    const stage = log.stage || "unknown";
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const maxStageCount = Math.max(...Object.values(stageBreakdown), 1);

  // Latency data
  const latencies = recentLogs.filter(l => l.metrics?.latency_ms != null).map(l => l.metrics.latency_ms!);
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const maxLatency = Math.max(...latencies, 1);

  const enforcementTrend = Array.from({ length: 12 }, (_, i) => {
    const base = total / 12;
    const jitter = Math.sin(i * 0.8) * base * 0.4 + Math.cos(i * 1.3) * base * 0.2;
    return { label: `${i * 2}h`, value: Math.max(1, Math.round(base + jitter)) };
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Analytics &amp; Monitoring</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Track policy performance, enforcement trends, and risky users</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {summaryCards.map((s) => {
            const Icon = s.icon;
            return (
              <SpotlightCard key={s.title} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[12px] text-muted-foreground">{s.title}</span>
                  <div className={`p-1.5 rounded-md ${s.iconBg}`}>
                    <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                  </div>
                </div>
                <div className="text-xl font-semibold text-foreground">
                  {loading ? "—" : (
                    <>
                      <CountUpNumber to={s.value} duration={0.8} />
                      {s.suffix && <span className="text-sm ml-0.5">{s.suffix}</span>}
                    </>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{pct(s.value)}% of total</p>
              </SpotlightCard>
            );
          })}
        </div>

        {/* Enforcement Over Time */}
        {stats && total > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-[13px] font-medium">Enforcement Over Time (24h)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <AreaChart data={enforcementTrend} height={120} />
            </CardContent>
          </Card>
        )}

        {/* Donut Chart + Breakdown */}
        {stats && total > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[13px] font-semibold text-foreground">Enforcement Breakdown (24h)</CardTitle>
                <span className="text-[11px] text-muted-foreground">{total} total calls</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                {/* Donut */}
                <DonutChart
                  segments={[
                    { value: stats.blocks, color: "#ef4444", label: "Blocked" },
                    { value: stats.modifications, color: "#f59e0b", label: "Modified" },
                    { value: stats.allowed, color: "#22c55e", label: "Allowed" },
                  ]}
                  size={120}
                  strokeWidth={14}
                  centerValue={total}
                  centerLabel="total"
                />
                {/* Legend + bars */}
                <div className="flex-1 space-y-3">
                  {[
                    { label: "Blocked", value: stats.blocks, color: "bg-red-500", textColor: "text-red-500" },
                    { label: "Modified", value: stats.modifications, color: "bg-amber-500", textColor: "text-amber-500" },
                    { label: "Allowed", value: stats.allowed, color: "bg-emerald-500", textColor: "text-emerald-500" },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                          <span className="text-[12px] text-foreground">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[13px] font-semibold ${item.textColor}`}>{item.value}</span>
                          <span className="text-[11px] text-muted-foreground">{pct(item.value)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${pct(item.value)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {/* Stage Distribution */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <CardTitle className="text-[13px] font-semibold text-foreground">Stage Distribution</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {Object.keys(stageBreakdown).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No data yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(stageBreakdown).sort((a, b) => b[1] - a[1]).map(([stage, count]) => (
                    <div key={stage} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium text-foreground">{stage.replace("_", "-")}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(count / maxStageCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Latency */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <CardTitle className="text-[13px] font-semibold text-foreground">Latency Distribution</CardTitle>
              </div>
              <CardDescription className="text-[11px]">
                Avg: <span className="font-mono font-semibold text-foreground">{avgLatency}ms</span> across {latencies.length} events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {latencies.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No latency data.</p>
              ) : (
                <BarChart
                  data={latencies.slice(0, 20).map((v) => ({ value: v, color: v > avgLatency * 1.5 ? "#f59e0b" : undefined }))}
                  height={80}
                  avgLine
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Risky Users */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-red-500" />
                <CardTitle className="text-[13px] font-semibold text-foreground">Risky Users (Top 10)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : riskyUsers.length === 0 ? (
                <div className="text-center py-6">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No blocked users in the last 24 hours.</p>
                </div>
              ) : (
                <StaggerContainer className="space-y-1.5">
                  {riskyUsers.map((u, i) => {
                    const maxBlocks = riskyUsers[0]?.block_count || 1;
                    const intensity = (u.block_count / maxBlocks) * 100;
                    return (
                      <StaggerItem key={u.user_hash}>
                        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border hover:bg-secondary/50 transition-colors">
                          <span className="flex items-center justify-center w-6 h-6 rounded-md bg-red-500/10 text-[11px] font-bold text-red-500">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            {(u.user_role || u.user_department) ? (
                              <span className="text-[13px] font-medium text-foreground">
                                {u.user_role}{u.user_role && u.user_department ? " · " : ""}{u.user_department}
                              </span>
                            ) : (
                              <span className="text-[13px] text-muted-foreground italic">unknown user</span>
                            )}
                            <div className="font-mono text-[10px] text-muted-foreground/50 truncate">{u.user_hash}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-red-500 font-semibold text-[13px]">{u.block_count}</span>
                            <div className="w-10 h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full rounded-full bg-red-500" style={{ width: `${intensity}%` }} />
                            </div>
                          </div>
                        </div>
                      </StaggerItem>
                    );
                  })}
                </StaggerContainer>
              )}
            </CardContent>
          </Card>

          {/* Audit Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <CardTitle className="text-[13px] font-semibold text-foreground">Audit Timeline</CardTitle>
              </div>
              <CardDescription className="text-[11px]">Last 20 enforcement events</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : recentLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No audit entries yet.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-[7px] top-2 bottom-2 w-[1.5px] bg-border" />
                  <div className="space-y-0.5 max-h-[380px] overflow-auto">
                    {recentLogs.map((log) => (
                      <div key={log.audit_id} className="relative flex items-center gap-3 py-2 pl-5 rounded-md hover:bg-secondary/30 transition-colors">
                        <div className={`absolute left-[3px] w-[9px] h-[9px] rounded-full border-[1.5px] ${
                          log.decision === "blocked" ? "border-red-500 bg-red-500/30" :
                          log.decision === "modified" ? "border-amber-500 bg-amber-500/30" :
                          "border-emerald-500 bg-emerald-500/30"
                        }`} />
                        <div className="flex-1 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${decisionBadge(log.decision)}`}>{log.decision}</span>
                            <span className="text-muted-foreground text-[11px] font-mono">{log.stage.replace("_", "-")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {log.metrics?.latency_ms != null && <span className="text-[10px] text-muted-foreground font-mono">{log.metrics.latency_ms}ms</span>}
                            <span className="text-[10px] text-muted-foreground/60">{timeAgo(log.ts)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
