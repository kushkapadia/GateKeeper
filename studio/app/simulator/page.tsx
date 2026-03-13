"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiCall } from "@/lib/api";
import { Play, RotateCcw, CheckCircle2, XCircle, AlertTriangle, Zap } from "lucide-react";

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
      user: { role: userRole, department: userDept, clearance: userClearance },
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
    return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  };

  const decisionColor = (decision: string) => {
    if (decision === "blocked") return "border-red-200 bg-red-50/50 ring-1 ring-red-500/10";
    if (decision === "modified") return "border-amber-200 bg-amber-50/50 ring-1 ring-amber-500/10";
    return "border-emerald-200 bg-emerald-50/50 ring-1 ring-emerald-500/10";
  };

  const stageColors: Record<string, string> = {
    pre_query: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/20",
    pre_retrieval: "bg-violet-50 text-violet-700 ring-1 ring-violet-500/20",
    post_retrieval: "bg-amber-50 text-amber-700 ring-1 ring-amber-500/20",
    post_generation: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20",
  };

  const showArtifacts = stage === "post_retrieval" || stage === "post_generation";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Policy Simulator</h1>
          <p className="text-slate-500 mt-1">
            Test how your saved policies behave with different user contexts, queries, and pipeline data.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Left: Inputs ──────────────────────────── */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-900">Pipeline Stage</CardTitle>
                <CardDescription>
                  Choose which stage to simulate. Inputs update with appropriate defaults.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "pre_query", label: "Pre-Query" },
                    { value: "pre_retrieval", label: "Pre-Retrieval" },
                    { value: "post_retrieval", label: "Post-Retrieval" },
                    { value: "post_generation", label: "Post-Generation" },
                  ].map((s) => (
                    <button
                      key={s.value}
                      onClick={() => handleStageChange(s.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        stage === s.value
                          ? stageColors[s.value]
                          : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-900">User Context</CardTitle>
                <CardDescription>
                  Simulate as a specific user. Checked against policy conditions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Role</Label>
                    <Input value={userRole} onChange={(e) => setUserRole(e.target.value)} placeholder="intern" className="h-9 bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Department</Label>
                    <Input value={userDept} onChange={(e) => setUserDept(e.target.value)} placeholder="HR" className="h-9 bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Clearance</Label>
                    <Input value={userClearance} onChange={(e) => setUserClearance(e.target.value)} placeholder="low" className="h-9 bg-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-900">Request Body</CardTitle>
                <CardDescription>
                  {stage === "pre_query" && "The query the user sent. Policies check query.text against blocked terms."}
                  {stage === "pre_retrieval" && "The retrieval request with existing filters."}
                  {stage === "post_retrieval" && "The original query. Chunks come from Artifacts below."}
                  {stage === "post_generation" && "The original query. Generated answer comes from Artifacts below."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full h-32 p-3 font-mono text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors resize-none"
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  spellCheck={false}
                />
              </CardContent>
            </Card>

            {showArtifacts && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-slate-900">Artifacts</CardTitle>
                  <CardDescription>
                    {stage === "post_retrieval" && "Document chunks from the vector DB. Policies can redact PII or drop sensitive chunks."}
                    {stage === "post_generation" && "The LLM's generated response including text, citations, and confidence."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <textarea
                    className="w-full h-44 p-3 font-mono text-sm border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-colors resize-none"
                    value={artifactsBody}
                    onChange={(e) => setArtifactsBody(e.target.value)}
                    spellCheck={false}
                  />
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSimulate}
                className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/25"
                disabled={loading}
              >
                {loading ? (
                  <Zap className="w-4 h-4 mr-2 animate-pulse" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {loading ? "Running..." : "Run Simulation"}
              </Button>
              <Button variant="outline" onClick={handleReset} className="h-11">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          {/* ── Right: Results ────────────────────────── */}
          <div className="space-y-4">
            {error && (
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="py-4">
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </CardContent>
              </Card>
            )}

            {result && (
              <>
                <Card className={decisionColor(result.decision)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {decisionIcon(result.decision)}
                      Decision: <span className="uppercase">{result.decision}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {result.metrics && (
                      <p className="text-xs text-slate-500 mb-3">
                        Evaluated in <span className="font-mono font-medium">{result.metrics.latencyMs}ms</span>
                      </p>
                    )}
                    {result.data && Object.keys(result.data).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-600">Data / Changes:</p>
                        <pre className="bg-white/80 p-3 rounded-lg text-xs overflow-auto max-h-48 border border-slate-100 font-mono">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {result.trace && result.trace.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold text-slate-900">Trace ({result.trace.length} {result.trace.length === 1 ? "policy" : "policies"} fired)</CardTitle>
                      <CardDescription>Each entry is a policy that matched and executed an action.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {result.trace.map((t: any, i: number) => (
                        <div key={i} className="border border-slate-100 rounded-lg p-3 text-sm space-y-2 bg-slate-50/50">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{t.policy}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-600 font-medium">{t.action}</span>
                          </div>
                          {t.details && Object.keys(t.details).length > 0 && (
                            <pre className="text-xs bg-white p-2 rounded-md overflow-auto max-h-32 border border-slate-100 font-mono">
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
                    <CardContent className="py-8 text-center">
                      <p className="text-slate-500 text-sm">No policies matched for this stage and user context.</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Make sure you have policies for &quot;{stage}&quot; whose conditions match role=&quot;{userRole}&quot;.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {result.policyContext && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold text-slate-900">LLM Policy Context</CardTitle>
                      <CardDescription>These instructions would be injected into the LLM&apos;s system prompt.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="bg-slate-50 p-3 rounded-lg text-xs overflow-auto max-h-48 border border-slate-100 font-mono">
                        {JSON.stringify(result.policyContext, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {!result && !error && (
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 mb-4">
                    <Play className="w-5 h-5 text-indigo-500" />
                  </div>
                  <p className="text-slate-600 font-medium">Click &quot;Run Simulation&quot; to test your policies</p>
                  <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                    The simulator runs the same evaluation engine as the real <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">/v1/enforce</code> endpoint.
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
