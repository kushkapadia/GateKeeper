"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiCall } from "@/lib/api";
import { ShieldAlert, ShieldCheck, PenTool, Clock, Activity } from "lucide-react";

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

  const pct = (n: number) => {
    if (!stats || stats.total_enforcements === 0) return "0";
    return Math.round((n / stats.total_enforcements) * 100).toString();
  };

  const summaryCards = [
    { title: "Blocks (24h)", value: stats?.blocks ?? 0, icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50" },
    { title: "Modifications (24h)", value: stats?.modifications ?? 0, icon: PenTool, color: "text-amber-600", bg: "bg-amber-50" },
    { title: "Allowed (24h)", value: stats?.allowed ?? 0, icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Avg Latency", value: `${stats?.avg_latency_ms ?? 0}ms`, icon: Clock, color: "text-slate-600", bg: "bg-slate-100" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics &amp; Monitoring</h1>
          <p className="text-slate-500 mt-1">Track policy performance, enforcement trends, and risky users</p>
        </div>

        {/* ── Summary Cards ──────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-4">
          {summaryCards.map((s) => {
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
                  <p className="text-xs text-slate-500 mt-1">{pct(typeof s.value === "number" ? s.value : 0)}% of total</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Enforcement Breakdown Bar ──────────────────── */}
        {stats && stats.total_enforcements > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-slate-900">Enforcement Breakdown (24h)</CardTitle>
              <CardDescription>{stats.total_enforcements} total enforcement calls</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                {stats.blocks > 0 && (
                  <div className="bg-red-500 transition-all" style={{ width: `${pct(stats.blocks)}%` }} title={`${stats.blocks} blocked`} />
                )}
                {stats.modifications > 0 && (
                  <div className="bg-amber-500 transition-all" style={{ width: `${pct(stats.modifications)}%` }} title={`${stats.modifications} modified`} />
                )}
                {stats.allowed > 0 && (
                  <div className="bg-emerald-500 transition-all" style={{ width: `${pct(stats.allowed)}%` }} title={`${stats.allowed} allowed`} />
                )}
              </div>
              <div className="flex gap-5 mt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Blocked ({stats.blocks})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Modified ({stats.modifications})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Allowed ({stats.allowed})</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* ── Risky Users ──────────────────────────────── */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <CardTitle className="text-base font-semibold text-slate-900">Risky Users (Top 10)</CardTitle>
              </div>
              <CardDescription>Users with the most blocked requests in 24h</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : riskyUsers.length === 0 ? (
                <p className="text-sm text-slate-400">No blocked users in the last 24 hours.</p>
              ) : (
                <div className="space-y-2">
                  {riskyUsers.map((u, i) => (
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
                      <div className="flex items-center gap-3">
                        <span className="text-red-600 font-semibold">{u.block_count} blocks</span>
                        <span className="text-xs text-slate-400">{timeAgo(u.last_blocked)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Audit Log ────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-400" />
                <CardTitle className="text-base font-semibold text-slate-900">Recent Audit Log</CardTitle>
              </div>
              <CardDescription>Last 20 enforcement events</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : recentLogs.length === 0 ? (
                <p className="text-sm text-slate-400">No audit entries yet.</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-auto">
                  {recentLogs.map((log) => (
                    <div key={log.audit_id} className="flex items-center justify-between text-sm py-2.5 px-2 rounded-lg hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${decisionBadge(log.decision)}`}>
                          {log.decision}
                        </span>
                        <span className="text-slate-500 text-xs">{log.stage.replace("_", "-")}</span>
                        {log.policies && log.policies.length > 0 && (
                          <span className="text-xs text-slate-400">
                            ({log.policies.length} {log.policies.length === 1 ? "policy" : "policies"})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {log.metrics?.latency_ms != null && (
                          <span className="text-xs text-slate-400">{log.metrics.latency_ms}ms</span>
                        )}
                        <span className="text-xs text-slate-400">{timeAgo(log.ts)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
