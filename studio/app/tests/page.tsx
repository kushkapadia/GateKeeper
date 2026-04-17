"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TestTube, Plus } from "lucide-react";

export default function TestsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Test Suites</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Manage and run policy test cases</p>
        </div>

        <Card>
          <CardContent className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <TestTube className="w-5 h-5 text-primary" />
            </div>
            <p className="text-muted-foreground mb-4">No test suites yet</p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Test Suite
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
