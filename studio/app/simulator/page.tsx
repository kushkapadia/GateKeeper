"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiCall } from "@/lib/api";
import { Play, RotateCcw, CheckCircle2, XCircle, AlertTriangle, Zap, ChevronRight, User, Send, Shield, Eye } from "lucide-react";

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
    if (decision === "blocked") return "border-red-500/20 bg-red-500/5";
    if (decision === "modified") return "border-amber-500/20 bg-amber-500/5";
    return "border-emerald-500/20 bg-emerald-500/5";
  };

  const stageColors: Record<string, string> = {
    pre_query: "bg-primary/10 text-primary border-primary/20",
    pre_retrieval: "bg-accent/10 text-accent-foreground border-accent/20",
    post_retrieval: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    post_generation: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  };

  const stageInactiveColors = "bg-secondary text-muted-foreground border-transparent hover:bg-secondary/80";

  const showArtifacts = stage === "post_retrieval" || stage === "post_generation";

  const stages = [
    { value: "pre_query", label: "Pre-Query", num: 1 },
    { value: "pre_retrieval", label: "Pre-Retrieval", num: 2 },
    { value: "post_retrieval", label: "Post-Retrieval", num: 3 },
    { value: "post_generation", label: "Post-Generation", num: 4 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Policy Simulator</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Test how your saved policies behave with different user contexts and queries.</p>
        </div>

        {/* Pipeline Stage Selector */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-foreground">Pipeline Stage</span>
              <span className="text-[11px] text-muted-foreground">Select stage to simulate</span>
            </div>
            <div className="flex items-center gap-2">
              {stages.map((s, i) => (
                <div key={s.value} className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => handleStageChange(s.value)}
                    className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-medium border transition-all duration-200 ${
                      stage === s.value ? stageColors[s.value] : stageInactiveColors
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                      stage === s.value ? "bg-current/20 text-current" : "bg-muted-foreground/10"
                    }`}>{s.num}</span>
                    {s.label}
                  </button>
                  {i < stages.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Left: Chat-like Input ──────────────────── */}
          <div className="space-y-4 space-y-4">
            {/* User Context */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm font-semibold text-foreground">User Context</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Role</Label>
                    <Input value={userRole} onChange={(e) => setUserRole(e.target.value)} placeholder="intern" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Department</Label>
                    <Input value={userDept} onChange={(e) => setUserDept(e.target.value)} placeholder="HR" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Clearance</Label>
                    <Input value={userClearance} onChange={(e) => setUserClearance(e.target.value)} placeholder="low" className="h-9" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Query Input — Chat Style */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm font-semibold text-foreground">Request Body</CardTitle>
                </div>
                <CardDescription className="text-[11px]">
                  {stage === "pre_query" && "The query the user sent. Policies check query.text against blocked terms."}
                  {stage === "pre_retrieval" && "The retrieval request with existing filters."}
                  {stage === "post_retrieval" && "The original query. Chunks come from Artifacts below."}
                  {stage === "post_generation" && "The original query. Generated answer comes from Artifacts below."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full h-32 p-3 font-mono text-sm border border-border rounded-xl bg-secondary/30 focus:bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200 resize-none text-foreground"
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  spellCheck={false}
                />
              </CardContent>
            </Card>

            {showArtifacts && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-accent-foreground" />
                    <CardTitle className="text-sm font-semibold text-foreground">Artifacts</CardTitle>
                  </div>
                  <CardDescription className="text-[11px]">
                    {stage === "post_retrieval" && "Document chunks from the vector DB."}
                    {stage === "post_generation" && "The LLM's generated response."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <textarea
                    className="w-full h-44 p-3 font-mono text-sm border border-border rounded-xl bg-secondary/30 focus:bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200 resize-none text-foreground"
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
                className="flex-1 h-11 bg-primary text-primary-foreground hover:bg-primary/90"
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
          <div className="space-y-4 space-y-4">
            {error && (
              <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="py-4">
                  <p className="text-sm text-red-400 font-medium">{error}</p>
                </CardContent>
              </Card>
            )}

            {result && (
              <>
                {/* Decision Card */}
                <Card className={`${decisionColor(result.decision)}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                      {decisionIcon(result.decision)}
                      Decision: <span className="uppercase font-bold">{result.decision}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {result.metrics && (
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">
                          Evaluated in <span className="font-mono font-semibold text-foreground">{result.metrics.latencyMs}ms</span>
                        </span>
                      </div>
                    )}
                    {result.data && Object.keys(result.data).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Data / Changes</p>
                        <pre className="bg-secondary/50 p-3 rounded-xl text-[11px] overflow-auto max-h-48 border border-border/40 font-mono text-foreground">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Step-by-step Execution Trace */}
                {result.trace && result.trace.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        <CardTitle className="text-sm font-semibold text-foreground">
                          Execution Trace ({result.trace.length} {result.trace.length === 1 ? "policy" : "policies"})
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-border" />
                        <div className="space-y-3">
                          {result.trace.map((t: any, i: number) => (
                            <div key={i} className="relative flex gap-4 pl-9">
                              {/* Timeline dot */}
                              <div className={`absolute left-[9px] top-3 w-[14px] h-[14px] rounded-full border-2 ${
                                t.action === "block" ? "border-red-500 bg-red-500/20" :
                                t.action === "redact" ? "border-amber-500 bg-amber-500/20" :
                                "border-primary bg-primary/20"
                              }`} />

                              <div className="flex-1 border border-border/40 rounded-xl p-3 bg-secondary/20 hover:bg-secondary/40 transition-all duration-200">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-sm text-foreground">{t.policy}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                                    t.action === "block" ? "bg-red-500/10 text-red-400" :
                                    t.action === "redact" ? "bg-amber-500/10 text-amber-400" :
                                    "bg-primary/10 text-primary"
                                  }`}>{t.action}</span>
                                </div>
                                {t.details && Object.keys(t.details).length > 0 && (
                                  <pre className="text-[11px] bg-secondary/50 p-2 rounded-lg overflow-auto max-h-24 border border-border/20 font-mono text-muted-foreground mt-2">
                                    {JSON.stringify(t.details, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {result.trace && result.trace.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground text-sm">No policies matched for this stage and user context.</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">
                        Make sure you have policies for &quot;{stage}&quot; whose conditions match role=&quot;{userRole}&quot;.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {result.policyContext && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-foreground">LLM Policy Context</CardTitle>
                      <CardDescription className="text-[11px]">Instructions injected into the LLM&apos;s system prompt.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="bg-secondary/50 p-3 rounded-xl text-[11px] overflow-auto max-h-48 border border-border/40 font-mono text-foreground">
                        {JSON.stringify(result.policyContext, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {!result && !error && (
              <Card>
                <CardContent className="py-20 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
                    <Play className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-foreground font-medium">Click &quot;Run Simulation&quot; to test your policies</p>
                  <p className="text-[11px] text-muted-foreground mt-2 max-w-sm mx-auto">
                    The simulator runs the same evaluation engine as the real <code className="bg-secondary px-1.5 py-0.5 rounded text-primary">/v1/enforce</code> endpoint.
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
