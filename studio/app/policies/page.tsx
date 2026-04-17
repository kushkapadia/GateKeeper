"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, AlertCircle, Pencil, ChevronLeft, Sparkles, Loader2, FileEdit, ChevronRight, Shield, Zap, Eye, Code } from "lucide-react";
import { apiCall } from "@/lib/api";

interface ConditionExpr {
  field: string;
  operator: "==" | "!=" | "contains" | "in";
  value: string;
}

interface PolicyForm {
  name: string;
  stage: "pre_query" | "pre_retrieval" | "post_retrieval" | "post_generation";
  priority: number;
  enabled: boolean;
  whenMode: "any" | "all" | "none";
  conditions: ConditionExpr[];
  matchType: string;
  matchValue: string | string[];
  actionType: "block" | "rewrite" | "filter" | "redact" | "enforce";
  actionConfig: Record<string, any>;
  distilled_prompt: string;
  labels: string;
}

interface SavedPolicy {
  id: string;
  name: string;
  stage: string;
  priority: number;
  enabled: boolean;
  content: Record<string, any>;
  distilled_prompt: string;
  labels: Record<string, any>;
  created_at: string | null;
}

const EMPTY_FORM: PolicyForm = {
  name: "",
  stage: "pre_query",
  priority: 100,
  enabled: true,
  whenMode: "any",
  conditions: [{ field: "user.role", operator: "==", value: "" }],
  matchType: "",
  matchValue: "",
  actionType: "block",
  actionConfig: { message: "" },
  distilled_prompt: "",
  labels: "",
};

const CodeEditor = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <textarea
    className="w-full h-96 p-4 font-mono text-sm border border-border rounded-xl bg-secondary/30 focus:bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200 resize-none text-foreground"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    spellCheck={false}
  />
);

interface DescriptorField {
  name: string;
  type: string;
  example?: string;
  description?: string;
}

interface Descriptor {
  user_attributes?: DescriptorField[];
  doc_metadata?: DescriptorField[];
}

const PIPELINE_STAGES = [
  { key: "pre_query", label: "Pre-Query", desc: "Block dangerous queries", color: "primary", num: 1 },
  { key: "pre_retrieval", label: "Pre-Retrieval", desc: "Inject filters", color: "accent", num: 2 },
  { key: "post_retrieval", label: "Post-Retrieval", desc: "Filter/redact chunks", color: "primary", num: 3 },
  { key: "post_generation", label: "Post-Generation", desc: "Validate answers", color: "accent", num: 4 },
];

export default function PoliciesPage() {
  const [view, setView] = useState<"list" | "editor">("list");
  const [mode, setMode] = useState<"visual" | "yaml">("visual");
  const [editorStep, setEditorStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [policy, setPolicy] = useState<PolicyForm>({ ...EMPTY_FORM });
  const [yamlOutput, setYamlOutput] = useState("");
  const [lintErrors, setLintErrors] = useState<string[]>([]);
  const [descriptor, setDescriptor] = useState<Descriptor | null>(null);
  const [loadingDescriptor, setLoadingDescriptor] = useState(true);
  const [policies, setPolicies] = useState<SavedPolicy[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    fetchDescriptor();
    fetchPolicies();
  }, []);

  useEffect(() => {
    if (mode === "yaml" && policy.name) {
      generateYAML();
    }
  }, [policy, mode]);

  const fetchDescriptor = async () => {
    try {
      const data = await apiCall("/api/schema/descriptor?version=v0");
      setDescriptor(data.descriptor || {});
    } catch {
      /* descriptor is optional */
    } finally {
      setLoadingDescriptor(false);
    }
  };

  const fetchPolicies = async () => {
    try {
      const data = await apiCall("/api/policies?version=v0");
      setPolicies(data.policies || []);
    } catch {
      /* will show empty state */
    } finally {
      setLoadingPolicies(false);
    }
  };

  const handleSave = async () => {
    if (!policy.name || !policy.stage) return;
    setSaving(true);

    const content = buildPolicyContent();
    const payload: Record<string, any> = {
      name: policy.name,
      stage: policy.stage,
      content,
      priority: policy.priority,
      enabled: policy.enabled,
      distilled_prompt: policy.distilled_prompt,
      version: "v0",
    };

    const labelList = policy.labels.split(",").map((l) => l.trim()).filter(Boolean);
    if (labelList.length > 0) {
      payload.labels = Object.fromEntries(labelList.map((l) => [l, true]));
    }

    try {
      if (editingId) {
        await apiCall(`/api/policies/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiCall("/api/policies", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await fetchPolicies();
      setView("list");
      setEditingId(null);
      setPolicy({ ...EMPTY_FORM });
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this policy? This cannot be undone.")) return;
    try {
      await apiCall(`/api/policies/${id}`, { method: "DELETE" });
      await fetchPolicies();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleEdit = (p: SavedPolicy) => {
    const content = p.content || {};
    const when = content.when || {};
    let whenMode: "any" | "all" | "none" = "none";
    let conditions: ConditionExpr[] = [{ field: "user.role", operator: "==", value: "" }];
    if (when.any) {
      whenMode = "any";
      conditions = (when.any as any[]).map((c: any) => parseExpr(c.expr || ""));
    } else if (when.all) {
      whenMode = "all";
      conditions = (when.all as any[]).map((c: any) => parseExpr(c.expr || ""));
    }

    const match = content.match || {};
    const matchKeys = Object.keys(match);
    const matchType = matchKeys[0] || "";
    const matchValue = matchKeys.length > 0 ? match[matchKeys[0]] : "";

    const action = content.action || {};
    const { type: actionType, ...restAction } = action;

    const labels = p.labels ? Object.keys(p.labels).join(", ") : "";

    setPolicy({
      name: p.name,
      stage: p.stage as PolicyForm["stage"],
      priority: p.priority,
      enabled: p.enabled,
      whenMode,
      conditions: conditions.length > 0 ? conditions : [{ field: "user.role", operator: "==", value: "" }],
      matchType,
      matchValue,
      actionType: actionType || "block",
      actionConfig: restAction,
      distilled_prompt: p.distilled_prompt || "",
      labels,
    });
    setEditingId(p.id);
    setEditorStep(1);
    setView("editor");
  };

  const handleNew = () => {
    setPolicy({ ...EMPTY_FORM });
    setEditingId(null);
    setEditorStep(1);
    setView("editor");
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const result = await apiCall("/api/policies/generate", {
        method: "POST",
        body: JSON.stringify({ description: aiPrompt }),
      });
      const p = result.policy;
      if (!p) throw new Error("No policy returned");

      const content = p;
      const when = content.when || {};
      let whenMode: "any" | "all" | "none" = "none";
      let conditions: ConditionExpr[] = [{ field: "user.role", operator: "==", value: "" }];
      if (when.any) {
        whenMode = "any";
        conditions = (when.any as any[]).map((c: any) => parseExpr(c.expr || ""));
      } else if (when.all) {
        whenMode = "all";
        conditions = (when.all as any[]).map((c: any) => parseExpr(c.expr || ""));
      }

      const match = content.match || {};
      const matchKeys = Object.keys(match);
      const matchType = matchKeys[0] || "";
      let matchValue: string | string[] = "";
      if (matchKeys.length > 0) {
        const raw = match[matchKeys[0]];
        matchValue = Array.isArray(raw) ? raw : String(raw);
      }

      const action = content.action || {};
      const { type: actionType, ...restAction } = action;

      setPolicy({
        name: content.name || "ai-generated-policy",
        stage: content.stage || "pre_query",
        priority: 100,
        enabled: true,
        whenMode,
        conditions: conditions.length > 0 ? conditions : [{ field: "user.role", operator: "==", value: "" }],
        matchType,
        matchValue,
        actionType: actionType || "block",
        actionConfig: restAction,
        distilled_prompt: content.distilled_prompt || "",
        labels: "",
      });
      setAiPrompt("");
    } catch (err: any) {
      setAiError(err.message || "Failed to generate policy");
    } finally {
      setAiGenerating(false);
    }
  };

  const buildPolicyContent = () => {
    const when: any = {};
    if (policy.whenMode !== "none" && policy.conditions.length > 0) {
      const exprs = policy.conditions
        .filter((c) => c.field && c.value)
        .map((c) => ({ expr: buildExprString(c) }));
      if (exprs.length > 0) when[policy.whenMode] = exprs;
    }

    const match: any = {};
    if (policy.matchType && policy.matchValue) {
      match[policy.matchType] = Array.isArray(policy.matchValue)
        ? policy.matchValue
        : policy.matchValue;
    }

    const action: any = { type: policy.actionType };
    if (policy.actionType === "block") {
      action.message = policy.actionConfig.message || "Blocked by policy.";
    } else if (policy.actionType === "rewrite") {
      action.filters = policy.actionConfig.filters || {};
    } else if (policy.actionType === "filter") {
      action.keep_if = policy.actionConfig.keep_if || {};
      action.drop_if = policy.actionConfig.drop_if || {};
    } else if (policy.actionType === "redact") {
      action.patterns = policy.actionConfig.patterns || [];
      action.fields = policy.actionConfig.fields || [];
    } else if (policy.actionType === "enforce") {
      action.citations = policy.actionConfig.citations || {};
      action.min_confidence = policy.actionConfig.min_confidence || 0;
    }

    const result: any = {
      name: policy.name,
      stage: policy.stage,
    };
    if (Object.keys(when).length > 0) result.when = when;
    if (Object.keys(match).length > 0) result.match = match;
    result.action = action;
    if (policy.distilled_prompt) result.distilled_prompt = policy.distilled_prompt;
    return result;
  };

  const buildExprString = (c: ConditionExpr): string => {
    const numVal = Number(c.value);
    const isNumeric = !isNaN(numVal) && c.value.trim() !== "";
    if (c.operator === "==" || c.operator === "!=") {
      const rhs = isNumeric ? `${numVal}` : (c.value === "true" || c.value === "false") ? c.value : `"${c.value}"`;
      return `${c.field} ${c.operator} ${rhs}`;
    }
    if (c.operator === "contains") return `${c.field}.contains("${c.value}")`;
    if (c.operator === "in") {
      const arr = c.value.split(",").map((s) => s.trim().replace(/"/g, ""));
      return `${c.field} in [${arr.map((v) => `"${v}"`).join(", ")}]`;
    }
    return `${c.field} ${c.operator} ${isNumeric ? numVal : `"${c.value}"`}`;
  };

  const parseExpr = (expr: string): ConditionExpr => {
    if (expr.includes(".contains(")) {
      const [field, rest] = expr.split(".contains(");
      return { field, operator: "contains", value: rest.replace(/[")]/g, "") };
    }
    if (expr.includes(" in [")) {
      const [field, rest] = expr.split(" in [");
      const vals = rest.replace("]", "").split(",").map((s) => s.trim().replace(/"/g, ""));
      return { field, operator: "in", value: vals.join(", ") };
    }
    for (const op of ["==", "!="] as const) {
      if (expr.includes(` ${op} `)) {
        const [field, val] = expr.split(` ${op} `);
        return { field: field.trim(), operator: op, value: val.trim().replace(/"/g, "") };
      }
    }
    return { field: expr, operator: "==", value: "" };
  };

  const getFieldSuggestions = (): string[] => {
    const fields: string[] = [];
    if (descriptor?.user_attributes) {
      descriptor.user_attributes.forEach((attr) => fields.push(`user.${attr.name}`));
    }
    if (policy.stage === "pre_query") {
      fields.push("query.text", "query.intent");
    } else if (policy.stage === "pre_retrieval") {
      fields.push("request.filters", "request.top_k", "request.index");
    } else if (policy.stage === "post_retrieval") {
      fields.push("chunk.tags", "chunk.text", "chunk.metadata.sensitivity");
      descriptor?.doc_metadata?.forEach((meta) => fields.push(`chunk.metadata.${meta.name}`));
    } else if (policy.stage === "post_generation") {
      fields.push("answer.text", "answer.citations", "answer.confidence", "answer.tokens");
      descriptor?.doc_metadata?.forEach((meta) => fields.push(`answer.sources.metadata.${meta.name}`));
    }
    return fields;
  };

  const getFieldExamples = (fieldPath: string): string => {
    if (!descriptor) {
      if (fieldPath === "query.text") return "salary, CEO compensation, PAN";
      if (fieldPath === "query.intent") return "retrieval, question, command";
      if (fieldPath === "chunk.metadata.sensitivity") return "public, restricted, confidential";
      if (fieldPath === "answer.confidence") return "0.5, 0.7, 0.9";
      return "";
    }
    const parts = fieldPath.split(".");
    if (parts[0] === "user" && parts.length === 2) {
      const attr = descriptor.user_attributes?.find((a) => a.name === parts[1]);
      if (attr?.example) {
        if (attr.example.startsWith("[")) {
          try { return JSON.parse(attr.example).join(", "); } catch { return attr.example; }
        }
        return attr.example;
      }
    }
    if ((parts[0] === "doc" || parts[0] === "chunk") && parts[1] === "metadata" && parts.length === 3) {
      const meta = descriptor.doc_metadata?.find((m) => m.name === parts[2]);
      return meta?.example || "";
    }
    return "";
  };

  const getMatchFieldsForStage = () => {
    const f: string[] = [];
    if (policy.stage === "pre_query") f.push("query.text", "query.intent");
    else if (policy.stage === "pre_retrieval") f.push("request.filters", "request.top_k", "request.index");
    else if (policy.stage === "post_retrieval") {
      f.push("chunk.tags_any", "chunk.metadata.sensitivity");
      descriptor?.doc_metadata?.forEach((meta) => f.push(`chunk.metadata.${meta.name}`));
    } else if (policy.stage === "post_generation") {
      f.push("answer.text", "answer.citations", "answer.confidence");
    }
    return f;
  };

  const getStageHelpText = () => {
    switch (policy.stage) {
      case "pre_query": return "Available: user attributes + query text. Documents not retrieved yet.";
      case "pre_retrieval": return "Available: user attributes + request filters. Documents not retrieved yet.";
      case "post_retrieval": return "Available: user attributes + chunk metadata (tags, sensitivity) from retrieved chunks.";
      case "post_generation": return "Available: user attributes + answer metadata (citations, confidence, text).";
      default: return "";
    }
  };

  const generateYAML = () => {
    const content = buildPolicyContent();
    const lines: string[] = [];
    lines.push(`name: ${content.name}`);
    lines.push(`stage: ${content.stage}`);
    lines.push(`priority: ${policy.priority}`);
    lines.push(`enabled: ${policy.enabled}`);
    if (content.when) {
      lines.push(`when:`);
      lines.push(`  ${policy.whenMode}:`);
      lines.push(...JSON.stringify(content.when[policy.whenMode], null, 4).split("\n").map((l) => "    " + l));
    }
    if (content.match) {
      lines.push(`match:`);
      lines.push(...JSON.stringify(content.match, null, 2).split("\n").map((l) => "  " + l));
    }
    lines.push(`action:`);
    lines.push(...JSON.stringify(content.action, null, 2).split("\n").map((l) => "  " + l));
    if (content.distilled_prompt) lines.push(`distilled_prompt: "${content.distilled_prompt}"`);
    setYamlOutput(lines.join("\n") + "\n");
  };

  const addCondition = () => {
    setPolicy({ ...policy, conditions: [...policy.conditions, { field: "user.role", operator: "==", value: "" }] });
  };

  const removeCondition = (idx: number) => {
    setPolicy({ ...policy, conditions: policy.conditions.filter((_, i) => i !== idx) });
  };

  const updateCondition = (idx: number, updates: Partial<ConditionExpr>) => {
    const newConditions = [...policy.conditions];
    newConditions[idx] = { ...newConditions[idx], ...updates };
    if (updates.field && !newConditions[idx].value) {
      const examples = getFieldExamples(updates.field);
      if (examples) {
        newConditions[idx].value = examples.split(",")[0].trim().replace(/"/g, "");
      }
    }
    setPolicy({ ...policy, conditions: newConditions });
  };

  const handleLint = async () => {
    try {
      const content = buildPolicyContent();
      const result = await apiCall("/api/policies/lint", {
        method: "POST",
        body: JSON.stringify({
          descriptorVersion: "v0",
          policies: [content],
        }),
      });
      if (result.errors?.length > 0) {
        setLintErrors(result.errors.map((e: any) => e.message || JSON.stringify(e)));
      } else {
        setLintErrors([]);
        alert("Policy is valid!");
      }
    } catch (err: any) {
      setLintErrors([err.message]);
    }
  };

  const stageBadgeColor = (stage: string) => {
    switch (stage) {
      case "pre_query": return "bg-primary/10 text-primary";
      case "pre_retrieval": return "bg-accent/10 text-accent-foreground";
      case "post_retrieval": return "bg-amber-500/10 text-amber-500";
      case "post_generation": return "bg-emerald-500/10 text-emerald-500";
      default: return "bg-secondary text-muted-foreground";
    }
  };

  const actionBadgeColor = (action: string) => {
    switch (action) {
      case "block": return "bg-red-500/10 text-red-400";
      case "redact": return "bg-amber-500/10 text-amber-400";
      case "filter": return "bg-blue-500/10 text-blue-400";
      case "rewrite": return "bg-primary/10 text-primary";
      case "enforce": return "bg-emerald-500/10 text-emerald-400";
      default: return "bg-secondary text-muted-foreground";
    }
  };

  const editorSteps = [
    { num: 1, label: "Basic Info", icon: FileEdit },
    { num: 2, label: "Conditions", icon: Shield },
    { num: 3, label: "Match", icon: Eye },
    { num: 4, label: "Action", icon: Zap },
    { num: 5, label: "Prompt", icon: Sparkles },
  ];

  // ── List View ───────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center animate-fade-in">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Policies</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">Manage enforcement policies for your RAG pipeline</p>
            </div>
            <Button onClick={handleNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              New Policy
            </Button>
          </div>

          {/* Pipeline Overview */}
          <Card className="animate-fade-in overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Pipeline Stages</span>
              </div>
              <div className="flex items-center gap-2">
                {PIPELINE_STAGES.map((s, i) => {
                  const count = policies.filter(p => p.stage === s.key).length;
                  return (
                    <div key={s.key} className="flex items-center gap-2 flex-1">
                      <div className="flex-1 p-3 rounded-xl border border-border/40 bg-secondary/20 hover:bg-secondary/40 transition-all duration-200">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground">
                            {s.num}
                          </div>
                          <span className="text-[12px] font-semibold text-foreground">{s.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{count} {count === 1 ? "policy" : "policies"}</p>
                      </div>
                      {i < PIPELINE_STAGES.length - 1 && (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {loadingPolicies ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : policies.length === 0 ? (
            <Card className="animate-fade-in">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
                  <FileEdit className="w-6 h-6 text-primary" />
                </div>
                <p className="text-muted-foreground mb-4">No policies yet. Create your first policy to get started.</p>
                <Button onClick={handleNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Policy
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {policies.map((p, i) => (
                <Card key={p.id} className={!p.enabled ? "opacity-50" : ""}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/80">
                        <Shield className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{p.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${stageBadgeColor(p.stage)}`}>
                            {p.stage.replace("_", "-")}
                          </span>
                          {p.content?.action?.type && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${actionBadgeColor(p.content.action.type)}`}>
                              {p.content.action.type}
                            </span>
                          )}
                          {!p.enabled && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-medium">disabled</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Priority: {p.priority}
                          {p.distilled_prompt && <span className="text-muted-foreground/60"> · &quot;{p.distilled_prompt.slice(0, 60)}{p.distilled_prompt.length > 60 ? "..." : ""}&quot;</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(p)} className="hover:text-primary hover:border-primary/20">
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-400 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ── Editor View — 3-Column Layout ──────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex justify-between items-center animate-fade-in">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => { setView("list"); setEditingId(null); }}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{editingId ? "Edit Policy" : "New Policy"}</h1>
              {loadingDescriptor && <p className="text-[11px] text-muted-foreground mt-0.5">Loading descriptor...</p>}
              {!loadingDescriptor && !descriptor && (
                <p className="text-[11px] text-destructive mt-0.5">No descriptor found. Upload a schema descriptor first.</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleLint} disabled={!policy.name} size="sm">
              <Code className="w-3.5 h-3.5 mr-1.5" />
              Lint
            </Button>
            <Button onClick={handleSave} disabled={!policy.name || saving} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? "Saving..." : editingId ? "Update Policy" : "Save & Publish"}
            </Button>
          </div>
        </div>

        {/* Lint Errors */}
        {lintErrors.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5 animate-scale-in">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                Lint Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1">
                {lintErrors.map((err, i) => (
                  <li key={i} className="text-sm text-foreground">{err}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* AI Generation */}
        {!editingId && (
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardHeader className="py-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-accent-foreground" />
                Generate with AI
              </CardTitle>
              <CardDescription className="text-[11px]">
                Describe what you want in plain English. Review and edit before saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="w-full h-20 p-3 border border-primary/20 rounded-xl text-sm bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all resize-none text-foreground placeholder:text-muted-foreground"
                placeholder={`Examples:\n"Block interns from asking about salary" · "Redact all emails from chunks" · "Require 2+ citations"`}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                disabled={aiGenerating}
              />
              {aiError && <p className="text-sm text-red-400">{aiError}</p>}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleAiGenerate}
                  disabled={!aiPrompt.trim() || aiGenerating}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  size="sm"
                >
                  {aiGenerating ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate Policy</>
                  )}
                </Button>
                {aiGenerating && <p className="text-[11px] text-muted-foreground">This may take 10-30 seconds...</p>}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={mode} onValueChange={(v: string) => setMode(v as "visual" | "yaml")}>
          <TabsList>
            <TabsTrigger value="visual">Visual Builder</TabsTrigger>
            <TabsTrigger value="yaml">YAML Editor</TabsTrigger>
          </TabsList>

          <TabsContent value="visual">
            <div className="grid grid-cols-12 gap-5">
              {/* LEFT — Step Navigation (Policy Tree) */}
              <div className="col-span-3 space-y-3">
                {/* Pipeline Step Indicator */}
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pipeline Steps</p>
                    <div className="flex items-center gap-1 mb-4">
                      {PIPELINE_STAGES.map((s, i) => (
                        <div key={s.key} className="flex items-center gap-1 flex-1">
                          <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${policy.stage === s.key ? "bg-primary" : "bg-secondary"}`} />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-0.5">
                      {editorSteps.map((step) => {
                        const StepIcon = step.icon;
                        return (
                          <button
                            key={step.num}
                            onClick={() => setEditorStep(step.num)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
                              editorStep === step.num
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                              editorStep === step.num ? "bg-primary/20" : "bg-secondary"
                            }`}>
                              <StepIcon className="w-3 h-3" />
                            </div>
                            <span>{step.label}</span>
                            {editorStep === step.num && (
                              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* CENTER — Form Builder */}
              <div className="col-span-5 space-y-4">
                {editorStep === 1 && (
                  <Card className="animate-fade-in">
                    <CardHeader className="py-4">
                      <CardTitle className="text-sm">Basic Information</CardTitle>
                      <CardDescription className="text-[11px]">Define the policy identity and pipeline stage.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[12px]">Policy Name *</Label>
                        <Input value={policy.name} onChange={(e) => setPolicy({ ...policy, name: e.target.value })} placeholder="block-sensitive-queries" />
                        <p className="text-[10px] text-muted-foreground">Unique, descriptive name in kebab-case.</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[12px]">Stage *</Label>
                        <select className="w-full h-10 px-3 border border-border rounded-lg bg-card text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all" value={policy.stage} onChange={(e) => setPolicy({ ...policy, stage: e.target.value as PolicyForm["stage"] })}>
                          <option value="pre_query">Pre-Query (before vector search)</option>
                          <option value="pre_retrieval">Pre-Retrieval (add filters)</option>
                          <option value="post_retrieval">Post-Retrieval (filter chunks)</option>
                          <option value="post_generation">Post-Generation (validate answer)</option>
                        </select>
                        <p className="text-[10px] text-muted-foreground">{getStageHelpText()}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-[12px]">Priority</Label>
                          <Input type="number" value={policy.priority} onChange={(e) => setPolicy({ ...policy, priority: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[12px]">Labels</Label>
                          <Input value={policy.labels} onChange={(e) => setPolicy({ ...policy, labels: e.target.value })} placeholder="attack, pii, hr" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {editorStep === 2 && (
                  <Card className="animate-fade-in">
                    <CardHeader className="py-4">
                      <CardTitle className="text-sm">Conditions — WHO</CardTitle>
                      <CardDescription className="text-[11px]">Control who triggers this policy based on user attributes.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[12px]">Match Mode</Label>
                        <select className="w-full h-10 px-3 border border-border rounded-lg bg-card text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all" value={policy.whenMode} onChange={(e) => setPolicy({ ...policy, whenMode: e.target.value as "any" | "all" | "none" })}>
                          <option value="any">ANY condition (OR)</option>
                          <option value="all">ALL conditions (AND)</option>
                          <option value="none">No conditions — all users</option>
                        </select>
                      </div>

                      {policy.whenMode !== "none" && policy.conditions.map((cond, idx) => (
                        <div key={idx} className="flex gap-2 items-end p-3 border border-border/40 rounded-xl bg-secondary/20">
                          <div className="flex-1 grid grid-cols-3 gap-2">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] text-muted-foreground">Field</Label>
                              <Input value={cond.field} onChange={(e) => updateCondition(idx, { field: e.target.value })} placeholder="user.role" list={`field-suggestions-${idx}`} className="h-9 text-[12px]" />
                              <datalist id={`field-suggestions-${idx}`}>
                                {getFieldSuggestions().map((field) => (<option key={field} value={field} />))}
                              </datalist>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] text-muted-foreground">Operator</Label>
                              <select className="w-full h-9 px-2 border border-border rounded-lg bg-card text-[12px] text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all" value={cond.operator} onChange={(e) => updateCondition(idx, { operator: e.target.value as any })}>
                                <option value="==">equals</option>
                                <option value="!=">not equals</option>
                                <option value="contains">contains</option>
                                <option value="in">in list</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] text-muted-foreground">Value</Label>
                              <Input value={cond.value} onChange={(e) => updateCondition(idx, { value: e.target.value })} placeholder={getFieldExamples(cond.field) || "intern"} list={`value-examples-${idx}`} className="h-9 text-[12px]" />
                              {getFieldExamples(cond.field) && (
                                <datalist id={`value-examples-${idx}`}>
                                  {getFieldExamples(cond.field).split(",").map((ex) => ex.trim()).filter(Boolean).map((ex) => (<option key={ex} value={ex} />))}
                                </datalist>
                              )}
                            </div>
                          </div>
                          {policy.conditions.length > 1 && (
                            <Button variant="ghost" size="icon" onClick={() => removeCondition(idx)} className="text-destructive h-9 w-9">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {policy.whenMode !== "none" && (
                        <Button variant="outline" onClick={addCondition} className="w-full" size="sm">
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Add Condition
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {editorStep === 3 && (
                  <Card className="animate-fade-in">
                    <CardHeader className="py-4">
                      <CardTitle className="text-sm">Match — WHAT content</CardTitle>
                      <CardDescription className="text-[11px]">Define what content triggers the policy action.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-3 rounded-xl bg-secondary/30 border border-border/40 text-[10px] text-muted-foreground space-y-1">
                        {policy.stage === "pre_query" && <p>Set Match Field to <code className="bg-secondary px-1 rounded text-primary">query.text</code> and enter blocked keywords.</p>}
                        {policy.stage === "pre_retrieval" && <p>Match against request parameters to inject vector DB filters.</p>}
                        {policy.stage === "post_retrieval" && <p>Match against chunk metadata to decide which chunks to keep/drop/redact.</p>}
                        {policy.stage === "post_generation" && <p>Match against the LLM&apos;s answer for quality enforcement.</p>}
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-[12px]">Match Field</Label>
                          <Input value={policy.matchType} onChange={(e) => setPolicy({ ...policy, matchType: e.target.value })} placeholder={getMatchFieldsForStage()[0] || "e.g., query.text"} list="match-suggestions" />
                          <datalist id="match-suggestions">
                            {getMatchFieldsForStage().map((f) => (<option key={f} value={f} />))}
                          </datalist>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[12px]">Match Value</Label>
                          <Input
                            value={Array.isArray(policy.matchValue) ? policy.matchValue.join(", ") : policy.matchValue}
                            onChange={(e) => setPolicy({
                              ...policy,
                              matchValue: e.target.value.includes(",") ? e.target.value.split(",").map((s) => s.trim()) : e.target.value,
                            })}
                            placeholder='salary, PAN or ["salary", "PAN"]'
                          />
                          <p className="text-[10px] text-muted-foreground">Comma-separated for multiple terms.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {editorStep === 4 && (
                  <Card className="animate-fade-in">
                    <CardHeader className="py-4">
                      <CardTitle className="text-sm">Action — WHAT happens</CardTitle>
                      <CardDescription className="text-[11px]">Define the enforcement outcome when the policy fires.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[12px]">Action Type</Label>
                        <select className="w-full h-10 px-3 border border-border rounded-lg bg-card text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all" value={policy.actionType} onChange={(e) => setPolicy({ ...policy, actionType: e.target.value as PolicyForm["actionType"], actionConfig: {} })}>
                          <option value="block">Block — Reject entirely</option>
                          <option value="rewrite">Rewrite — Inject filters</option>
                          <option value="filter">Filter — Drop/keep chunks</option>
                          <option value="redact">Redact — Mask PII</option>
                          <option value="enforce">Enforce — Citations/confidence</option>
                        </select>
                      </div>

                      {policy.actionType === "block" && (
                        <div className="space-y-2">
                          <Label className="text-[12px]">Block Message</Label>
                          <Input value={policy.actionConfig.message || ""} onChange={(e) => setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, message: e.target.value } })} placeholder="Restricted topic for your role." />
                        </div>
                      )}

                      {policy.actionType === "rewrite" && (
                        <div className="space-y-2">
                          <Label className="text-[12px]">Add Filters (JSON)</Label>
                          <textarea className="w-full h-24 p-3 font-mono text-sm border border-border rounded-xl bg-secondary/30 focus:bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none text-foreground" value={JSON.stringify(policy.actionConfig.filters || {}, null, 2)}
                            onChange={(e) => { try { setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, filters: JSON.parse(e.target.value) } }); } catch {} }}
                            placeholder='{"department": "${user.department}"}' />
                        </div>
                      )}

                      {policy.actionType === "filter" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-[12px]">Keep If (JSON)</Label>
                            <textarea className="w-full h-24 p-3 font-mono text-sm border border-border rounded-xl bg-secondary/30 focus:bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none text-foreground" value={JSON.stringify(policy.actionConfig.keep_if || {}, null, 2)}
                              onChange={(e) => { try { setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, keep_if: JSON.parse(e.target.value) } }); } catch {} }}
                              placeholder='{"sensitivity": "public"}' />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[12px]">Drop If (JSON)</Label>
                            <textarea className="w-full h-24 p-3 font-mono text-sm border border-border rounded-xl bg-secondary/30 focus:bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none text-foreground" value={JSON.stringify(policy.actionConfig.drop_if || {}, null, 2)}
                              onChange={(e) => { try { setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, drop_if: JSON.parse(e.target.value) } }); } catch {} }}
                              placeholder='{"sensitivity": "confidential"}' />
                          </div>
                        </div>
                      )}

                      {policy.actionType === "redact" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-[12px]">Patterns</Label>
                            <Input value={Array.isArray(policy.actionConfig.patterns) ? policy.actionConfig.patterns.join(", ") : ""}
                              onChange={(e) => setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, patterns: e.target.value.split(",").map((s) => s.trim()) } })}
                              placeholder="EMAIL, PHONE, PAN" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[12px]">Fields</Label>
                            <Input value={Array.isArray(policy.actionConfig.fields) ? policy.actionConfig.fields.join(", ") : ""}
                              onChange={(e) => setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, fields: e.target.value.split(",").map((s) => s.trim()) } })}
                              placeholder="employee_name, amount" />
                          </div>
                        </div>
                      )}

                      {policy.actionType === "enforce" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-[12px]">Min Citations</Label>
                            <Input type="number" value={policy.actionConfig.citations?.min || 0}
                              onChange={(e) => setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, citations: { min: parseInt(e.target.value) || 0 } } })} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[12px]">Min Confidence</Label>
                            <Input type="number" step="0.01" value={policy.actionConfig.min_confidence || 0}
                              onChange={(e) => setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, min_confidence: parseFloat(e.target.value) || 0 } })} />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {editorStep === 5 && (
                  <Card className="animate-fade-in">
                    <CardHeader className="py-4">
                      <CardTitle className="text-sm">Distilled Prompt — LLM Guidance</CardTitle>
                      <CardDescription className="text-[11px]">Natural-language instruction injected into the LLM&apos;s system prompt.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <textarea className="w-full h-32 p-3 border border-border rounded-xl bg-secondary/30 focus:bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200 resize-none text-foreground text-sm" value={policy.distilled_prompt} onChange={(e) => setPolicy({ ...policy, distilled_prompt: e.target.value })}
                        placeholder="Do not answer about compensation/salaries of specific individuals." />
                      <p className="text-[10px] text-muted-foreground">Optional. Leave empty if the hard action alone is sufficient.</p>
                    </CardContent>
                  </Card>
                )}

                {/* Step Navigation Buttons */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditorStep(Math.max(1, editorStep - 1))}
                    disabled={editorStep === 1}
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Previous
                  </Button>
                  <span className="text-[11px] text-muted-foreground">Step {editorStep} of 5</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditorStep(Math.min(5, editorStep + 1))}
                    disabled={editorStep === 5}
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>

              {/* RIGHT — Live Preview */}
              <div className="col-span-4">
                <Card className="sticky top-8">
                  <CardHeader className="py-4">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-primary" />
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                    </div>
                    <CardDescription className="text-[11px]">How this policy will be evaluated</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Policy Summary */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Policy</span>
                        {policy.name && <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${stageBadgeColor(policy.stage)}`}>{policy.stage.replace("_", "-")}</span>}
                      </div>
                      <p className="text-sm font-semibold text-foreground">{policy.name || "Untitled Policy"}</p>
                    </div>

                    {/* Conditions Preview */}
                    {policy.whenMode !== "none" && policy.conditions.some(c => c.field && c.value) && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Conditions ({policy.whenMode})</span>
                        <div className="space-y-1">
                          {policy.conditions.filter(c => c.field && c.value).map((c, i) => (
                            <div key={i} className="px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border/30 text-[11px] font-mono text-foreground">
                              {buildExprString(c)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Match Preview */}
                    {policy.matchType && policy.matchValue && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Match</span>
                        <div className="px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border/30 text-[11px] font-mono text-foreground">
                          {policy.matchType}: {Array.isArray(policy.matchValue) ? policy.matchValue.join(", ") : policy.matchValue}
                        </div>
                      </div>
                    )}

                    {/* Action Preview */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Action</span>
                      <div className={`px-2.5 py-2 rounded-lg border border-border/30 ${actionBadgeColor(policy.actionType)}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase">{policy.actionType}</span>
                        </div>
                        {policy.actionType === "block" && policy.actionConfig.message && (
                          <p className="text-[10px] mt-1 opacity-70">&quot;{policy.actionConfig.message}&quot;</p>
                        )}
                      </div>
                    </div>

                    {/* Distilled Prompt Preview */}
                    {policy.distilled_prompt && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">LLM Guidance</span>
                        <div className="px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-foreground italic">
                          &quot;{policy.distilled_prompt}&quot;
                        </div>
                      </div>
                    )}

                    {/* Flow Visualization */}
                    <div className="pt-3 border-t border-border/40">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Query Flow</span>
                      <div className="mt-2 flex items-center gap-1.5">
                        {PIPELINE_STAGES.map((s) => (
                          <div key={s.key} className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                            policy.stage === s.key ? "bg-primary" : "bg-secondary"
                          }`} />
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        Policy fires at <span className="text-primary font-medium">{policy.stage.replace("_", "-")}</span> stage
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="yaml">
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm">Generated YAML</CardTitle>
                <CardDescription className="text-[11px]">
                  Raw policy definition. Edit directly for advanced configurations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CodeEditor value={yamlOutput} onChange={(v) => setYamlOutput(v)} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
