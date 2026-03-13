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
    if (d === "blocked") return "bg-red-100 text-red-700";
    if (d === "modified") return "bg-amber-100 text-amber-700";
    return "bg-green-100 text-green-700";
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics &amp; Monitoring</h1>
          <p className="text-muted-foreground mt-2">Track policy performance, enforcement trends, and risky users</p>
        </div>

        {/* ── Summary Cards ──────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocks (24h)</CardTitle>
              <ShieldAlert className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "…" : stats?.blocks ?? 0}</div>
              <p className="text-xs text-muted-foreground">{pct(stats?.blocks ?? 0)}% of total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Modifications (24h)</CardTitle>
              <PenTool className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "…" : stats?.modifications ?? 0}</div>
              <p className="text-xs text-muted-foreground">{pct(stats?.modifications ?? 0)}% of total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Allowed (24h)</CardTitle>
              <ShieldCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "…" : stats?.allowed ?? 0}</div>
              <p className="text-xs text-muted-foreground">{pct(stats?.allowed ?? 0)}% of total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "…" : `${stats?.avg_latency_ms ?? 0}ms`}</div>
              <p className="text-xs text-muted-foreground">Policy evaluation time</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Enforcement Breakdown Bar ──────────────────── */}
        {stats && stats.total_enforcements > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enforcement Breakdown (24h)</CardTitle>
              <CardDescription>{stats.total_enforcements} total enforcement calls</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-4 rounded-full overflow-hidden">
                {stats.blocks > 0 && (
                  <div className="bg-red-400" style={{ width: `${pct(stats.blocks)}%` }} title={`${stats.blocks} blocked`} />
                )}
                {stats.modifications > 0 && (
                  <div className="bg-amber-400" style={{ width: `${pct(stats.modifications)}%` }} title={`${stats.modifications} modified`} />
                )}
                {stats.allowed > 0 && (
                  <div className="bg-green-400" style={{ width: `${pct(stats.allowed)}%` }} title={`${stats.allowed} allowed`} />
                )}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Blocked ({stats.blocks})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Modified ({stats.modifications})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Allowed ({stats.allowed})</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* ── Risky Users ──────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                Risky Users (Top 10)
              </CardTitle>
              <CardDescription>Users with the most blocked requests in 24h</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : riskyUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No blocked users in the last 24 hours.</p>
              ) : (
                <div className="space-y-2">
                  {riskyUsers.map((u, i) => (
                    <div key={u.user_hash} className="flex items-center justify-between text-sm p-2 border rounded-md">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">#{i + 1}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            {(u.user_role || u.user_department) ? (
                              <span className="font-medium">
                                {u.user_role}{u.user_role && u.user_department ? " · " : ""}{u.user_department}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">unknown user</span>
                            )}
                          </div>
                          <span className="font-mono text-xs text-muted-foreground">{u.user_hash}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-red-600 font-semibold">{u.block_count} blocks</span>
                        <span className="text-xs text-muted-foreground">{timeAgo(u.last_blocked)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Audit Log ────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Recent Audit Log
              </CardTitle>
              <CardDescription>Last 20 enforcement events</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : recentLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit entries yet.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-auto">
                  {recentLogs.map((log) => (
                    <div key={log.audit_id} className="flex items-center justify-between text-sm p-2 border rounded-md">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${decisionBadge(log.decision)}`}>
                          {log.decision}
                        </span>
                        <span className="text-muted-foreground text-xs">{log.stage}</span>
                        {log.policies && log.policies.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({log.policies.length} {log.policies.length === 1 ? "policy" : "policies"})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {log.metrics?.latency_ms != null && (
                          <span className="text-xs text-muted-foreground">{log.metrics.latency_ms}ms</span>
                        )}
                        <span className="text-xs text-muted-foreground">{timeAgo(log.ts)}</span>
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
