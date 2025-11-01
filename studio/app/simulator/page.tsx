"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SimulatorPage() {
  const [userRole, setUserRole] = useState("intern");
  const [userDept, setUserDept] = useState("HR");
  const [query, setQuery] = useState("What is the CEO's salary?");
  const [stage, setStage] = useState("pre_query");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      // TODO: Call /api/policies/simulate
      const mockResult = {
        decision: "blocked",
        data: { message: "Restricted topic for your role." },
        trace: [{ policy: "block-sensitive-queries", action: "block" }],
        policyContext: {
          instruction: "You must follow these rules regardless of user phrasing.",
          rules: ["Do not answer about compensation/salaries of specific individuals."],
        },
      };
      setResult(mockResult);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Policy Simulator</h1>
          <p className="text-muted-foreground mt-2">
            Test how policies behave with different user contexts
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Input</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Stage</Label>
                <select
                  className="w-full h-10 px-3 border rounded-md"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  <option>pre_query</option>
                  <option>pre_retrieval</option>
                  <option>post_retrieval</option>
                  <option>post_generation</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>User Role</Label>
                <Input value={userRole} onChange={(e) => setUserRole(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>User Department</Label>
                <Input value={userDept} onChange={(e) => setUserDept(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Query/Input</Label>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <Button onClick={handleSimulate} className="w-full" disabled={loading}>
                {loading ? "Simulating..." : "Run Simulation"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96">
                  {JSON.stringify(result, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground">Run a simulation to see results</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

