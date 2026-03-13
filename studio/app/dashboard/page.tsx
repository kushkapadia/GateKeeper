"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useDescriptorStore } from "@/lib/store";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiCall } from "@/lib/api";
import Link from "next/link";
import { FileEdit, Play, BarChart, AlertCircle, ShieldAlert, Clock, Activity } from "lucide-react";

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Overview of your policy management system</p>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Policies</CardTitle>
              <FileEdit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "…" : stats?.policies.total ?? 0}</div>
              <p className="text-xs text-muted-foreground">Active policies across all stages</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocks (24h)</CardTitle>
              <ShieldAlert className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "…" : enforcement?.blocks ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                {enforcement && enforcement.total_enforcements > 0
                  ? `${Math.round((enforcement.blocks / enforcement.total_enforcements) * 100)}% of ${enforcement.total_enforcements} total`
                  : "No enforcements yet"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Risky Users</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "…" : risky.length}</div>
              <p className="text-xs text-muted-foreground">Users blocked in last 24h</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "…" : `${enforcement?.avg_latency_ms ?? 0}ms`}</div>
              <p className="text-xs text-muted-foreground">Policy evaluation time (24h avg)</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* ── Quick Actions ───────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/policies">
                <Button className="w-full justify-start" variant="outline">
                  <FileEdit className="w-4 h-4 mr-2" />
                  Create New Policy
                </Button>
              </Link>
              <Link href="/simulator">
                <Button className="w-full justify-start" variant="outline">
                  <Play className="w-4 h-4 mr-2" />
                  Run Simulator
                </Button>
              </Link>
              <Link href="/analytics">
                <Button className="w-full justify-start" variant="outline">
                  <BarChart className="w-4 h-4 mr-2" />
                  View Analytics
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* ── Recent Activity ─────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest enforcement events</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No enforcement events yet. Use the Simulator or call <code>/v1/enforce</code> to generate activity.</p>
              ) : (
                <div className="space-y-3">
                  {activity.map((a) => (
                    <div key={a.audit_id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${decisionBadge(a.decision)}`}>
                          {a.decision}
                        </span>
                        <span className="text-muted-foreground">{a.stage}</span>
                        {a.source === "simulate" && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">sim</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{timeAgo(a.ts)}</span>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                Risky Users (24h)
              </CardTitle>
              <CardDescription>Users with the most blocked requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {risky.map((u, i) => (
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
                    <div className="flex items-center gap-4">
                      <span className="text-red-600 font-semibold">{u.block_count} blocks</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(u.last_blocked)}</span>
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
