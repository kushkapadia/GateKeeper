"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TestTube, Plus } from "lucide-react";

export default function TestsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Test Suites</h1>
          <p className="text-slate-500 mt-1">Manage and run policy test cases</p>
        </div>

        <Card>
          <CardContent className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 mb-4">
              <TestTube className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-slate-500 mb-4">No test suites yet</p>
            <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/25">
              <Plus className="w-4 h-4 mr-2" />
              Create Test Suite
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
