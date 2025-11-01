"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics & Monitoring</h1>
          <p className="text-muted-foreground mt-2">Track policy performance and risky users</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Risky Users (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">No risky users detected</p>
              {/* TODO: Fetch from /api/analytics/risky-users */}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Blocks (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Redactions (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Avg Latency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0ms</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

