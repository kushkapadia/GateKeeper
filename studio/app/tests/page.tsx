"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TestsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Test Suites</h1>
          <p className="text-muted-foreground mt-2">Manage and run policy test cases</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Saved Test Suites</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No test suites yet</p>
            <Button className="mt-4">Create Test Suite</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

