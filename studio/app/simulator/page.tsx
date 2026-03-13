"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiCall } from "@/lib/api";
import { Play, RotateCcw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const STAGE_DEFAULTS: Record<string, { request: string; artifacts: string }> = {
  pre_query: {
    request: JSON.stringify({ query: "What is the CEO's salary?" }, null, 2),
    artifacts: "",
  },
  pre_retrieval: {
    request: JSON.stringify({ query: "Show HR documents", filters: {}, top_k: 10 }, null, 2),
    artifacts: "",
  },
  post_retrieval: {
    request: JSON.stringify({ query: "Show employee info" }, null, 2),
    artifacts: JSON.stringify({
      chunks: [
        { text: "John Doe, email john@acme.com, phone 555-1234", metadata: { sensitivity: "public", tags: ["hr"] } },
        { text: "Confidential: CEO salary is $500k", metadata: { sensitivity: "confidential", tags: ["finance"] } },
      ],
    }, null, 2),
  },
  post_generation: {
    request: JSON.stringify({ query: "What is John's email?" }, null, 2),
    artifacts: JSON.stringify({
      generated_response: {
        text: "John's email is john@acme.com and phone is 555-1234.",
        citations: [{ source: "hr-doc-1" }],
        confidence: 0.85,
      },
    }, null, 2),
  },
};

export default function SimulatorPage() {
  const [stage, setStage] = useState("pre_query");
  const [userRole, setUserRole] = useState("intern");
  const [userDept, setUserDept] = useState("HR");
  const [userClearance, setUserClearance] = useState("low");
  const [requestBody, setRequestBody] = useState(STAGE_DEFAULTS.pre_query.request);
  const [artifactsBody, setArtifactsBody] = useState(STAGE_DEFAULTS.pre_query.artifacts);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStageChange = (newStage: string) => {
    setStage(newStage);
    setRequestBody(STAGE_DEFAULTS[newStage]?.request || "{}");
    setArtifactsBody(STAGE_DEFAULTS[newStage]?.artifacts || "");
    setResult(null);
    setError(null);
  };

  const handleReset = () => {
    handleStageChange(stage);
    setUserRole("intern");
    setUserDept("HR");
    setUserClearance("low");
    setResult(null);
    setError(null);
  };

  const handleSimulate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    let parsedRequest: any;
    let parsedArtifacts: any = undefined;
    try {
      parsedRequest = JSON.parse(requestBody);
    } catch {
      setError("Request body is not valid JSON.");
      setLoading(false);
      return;
    }
    if (artifactsBody.trim()) {
      try {
        parsedArtifacts = JSON.parse(artifactsBody);
      } catch {
        setError("Artifacts body is not valid JSON.");
        setLoading(false);
        return;
      }
    }

    const payload: Record<string, any> = {
      stage,
      user: {
        role: userRole,
        department: userDept,
        clearance: userClearance,
      },
      request: parsedRequest,
    };
    if (parsedArtifacts) payload.artifacts = parsedArtifacts;

    try {
      const data = await apiCall("/api/policies/simulate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Simulation failed.");
    } finally {
      setLoading(false);
    }
  };

  const decisionIcon = (decision: string) => {
    if (decision === "blocked") return <XCircle className="w-5 h-5 text-red-500" />;
    if (decision === "modified") return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  };

  const decisionColor = (decision: string) => {
    if (decision === "blocked") return "border-red-300 bg-red-50/50";
    if (decision === "modified") return "border-amber-300 bg-amber-50/50";
    return "border-green-300 bg-green-50/50";
  };

  const showArtifacts = stage === "post_retrieval" || stage === "post_generation";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Policy Simulator</h1>
          <p className="text-muted-foreground mt-2">
            Test how your saved policies behave with different user contexts, queries, and pipeline data — all without making real LLM or retrieval calls.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Left: Inputs ──────────────────────────── */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Stage</CardTitle>
                <CardDescription>
                  Choose which stage to simulate. The request and artifacts fields below update with stage-appropriate defaults you can edit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <select
                  className="w-full h-10 px-3 border rounded-md"
                  value={stage}
                  onChange={(e) => handleStageChange(e.target.value)}
                >
                  <option value="pre_query">Pre-Query — block/flag before retrieval</option>
                  <option value="pre_retrieval">Pre-Retrieval — inject metadata filters</option>
                  <option value="post_retrieval">Post-Retrieval — filter/redact chunks</option>
                  <option value="post_generation">Post-Generation — validate LLM answer</option>
                </select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Context</CardTitle>
                <CardDescription>
                  Simulate as a specific user. These values are checked against the &quot;Conditions (When)&quot; section of your policies.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Role</Label>
                    <Input value={userRole} onChange={(e) => setUserRole(e.target.value)} placeholder="intern" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Department</Label>
                    <Input value={userDept} onChange={(e) => setUserDept(e.target.value)} placeholder="HR" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Clearance</Label>
                    <Input value={userClearance} onChange={(e) => setUserClearance(e.target.value)} placeholder="low" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Request Body</CardTitle>
                <CardDescription>
                  {stage === "pre_query" && "The query the user sent. Policies will check query.text against blocked terms."}
                  {stage === "pre_retrieval" && "The retrieval request with existing filters. Policies may inject additional metadata filters."}
                  {stage === "post_retrieval" && "The original query. Chunks come from the Artifacts field below."}
                  {stage === "post_generation" && "The original query. The generated answer comes from the Artifacts field below."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full h-32 p-3 font-mono text-sm border rounded-md bg-muted"
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  spellCheck={false}
                />
              </CardContent>
            </Card>

            {showArtifacts && (
              <Card>
                <CardHeader>
                  <CardTitle>Artifacts</CardTitle>
                  <CardDescription>
                    {stage === "post_retrieval" && "The document chunks retrieved from the vector DB. Policies can redact PII or drop sensitive chunks here."}
                    {stage === "post_generation" && "The LLM's generated response including text, citations, and confidence score. Policies can redact, enforce citations, or block."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <textarea
                    className="w-full h-44 p-3 font-mono text-sm border rounded-md bg-muted"
                    value={artifactsBody}
                    onChange={(e) => setArtifactsBody(e.target.value)}
                    spellCheck={false}
                  />
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSimulate} className="flex-1" disabled={loading}>
                <Play className="w-4 h-4 mr-2" />
                {loading ? "Running..." : "Run Simulation"}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          {/* ── Right: Results ────────────────────────── */}
          <div className="space-y-4">
            {error && (
              <Card className="border-red-300">
                <CardContent className="py-4">
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </CardContent>
              </Card>
            )}

            {result && (
              <>
                <Card className={decisionColor(result.decision)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      {decisionIcon(result.decision)}
                      Decision: <span className="uppercase">{result.decision}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {result.metrics && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Evaluated in {result.metrics.latencyMs}ms
                      </p>
                    )}
                    {result.data && Object.keys(result.data).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium">Data / Changes:</p>
                        <pre className="bg-white/80 p-3 rounded text-xs overflow-auto max-h-48 border">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {result.trace && result.trace.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Trace ({result.trace.length} {result.trace.length === 1 ? "policy" : "policies"} fired)</CardTitle>
                      <CardDescription>Each entry is a policy that matched and executed an action.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {result.trace.map((t: any, i: number) => (
                        <div key={i} className="border rounded-md p-3 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{t.policy}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{t.action}</span>
                          </div>
                          {t.details && Object.keys(t.details).length > 0 && (
                            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                              {JSON.stringify(t.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {result.trace && result.trace.length === 0 && (
                  <Card>
                    <CardContent className="py-6 text-center">
                      <p className="text-muted-foreground text-sm">No policies matched for this stage and user context.</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Make sure you have policies saved for the &quot;{stage}&quot; stage whose conditions match role=&quot;{userRole}&quot;.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {result.policyContext && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">LLM Policy Context (Distilled Prompts)</CardTitle>
                      <CardDescription>These instructions would be injected into the LLM&apos;s system prompt for this user.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-48">
                        {JSON.stringify(result.policyContext, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {!result && !error && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Click &quot;Run Simulation&quot; to test your policies against the input on the left.</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    The simulator runs the same evaluation engine as the real <code>/v1/enforce</code> endpoint, using policies saved in your database.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
