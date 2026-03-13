"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, AlertCircle, Pencil, ChevronLeft, Sparkles, Loader2 } from "lucide-react";
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
    className="w-full h-96 p-4 font-mono text-sm border rounded-md bg-muted"
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

export default function PoliciesPage() {
  const [view, setView] = useState<"list" | "editor">("list");
  const [mode, setMode] = useState<"visual" | "yaml">("visual");
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

  // ── Save / Update ──────────────────────────────────────────────────────
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
    setView("editor");
  };

  const handleNew = () => {
    setPolicy({ ...EMPTY_FORM });
    setEditingId(null);
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

  // ── Content builder ─────────────────────────────────────────────────────
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

  // ── Helpers ─────────────────────────────────────────────────────────────
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
      case "pre_query": return "bg-blue-100 text-blue-800";
      case "pre_retrieval": return "bg-purple-100 text-purple-800";
      case "post_retrieval": return "bg-amber-100 text-amber-800";
      case "post_generation": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // ── List View ───────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Policies</h1>
              <p className="text-muted-foreground mt-2">Manage enforcement policies for your RAG pipeline</p>
            </div>
            <Button onClick={handleNew}>
              <Plus className="w-4 h-4 mr-2" />
              New Policy
            </Button>
          </div>

          {loadingPolicies ? (
            <p className="text-muted-foreground">Loading policies...</p>
          ) : policies.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No policies yet. Create your first policy to get started.</p>
                <Button onClick={handleNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Policy
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {policies.map((p) => (
                <Card key={p.id} className={!p.enabled ? "opacity-60" : ""}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{p.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${stageBadgeColor(p.stage)}`}>
                            {p.stage}
                          </span>
                          {!p.enabled && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">disabled</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Priority: {p.priority}
                          {p.distilled_prompt && ` · "${p.distilled_prompt.slice(0, 60)}${p.distilled_prompt.length > 60 ? "..." : ""}"`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(p)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(p.id)}>
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

  // ── Editor View ─────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => { setView("list"); setEditingId(null); }}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{editingId ? "Edit Policy" : "New Policy"}</h1>
              {loadingDescriptor && <p className="text-xs text-muted-foreground mt-1">Loading descriptor...</p>}
              {!loadingDescriptor && !descriptor && (
                <p className="text-xs text-destructive mt-1">No descriptor found. Upload a schema descriptor first.</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleLint} disabled={!policy.name}>
              Lint
            </Button>
            <Button onClick={handleSave} disabled={!policy.name || saving}>
              {saving ? "Saving..." : editingId ? "Update Policy" : "Save & Publish"}
            </Button>
          </div>
        </div>

        {lintErrors.length > 0 && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                Lint Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1">
                {lintErrors.map((err, i) => (
                  <li key={i} className="text-sm">{err}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {!editingId && (
          <Card className="border-purple-200 bg-gradient-to-r from-purple-50/50 to-indigo-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Generate with AI
              </CardTitle>
              <CardDescription>
                Describe what you want in plain English and the AI will generate a complete policy for you. It knows your schema descriptor, all available stages, actions, and match fields. You can review and edit the result before saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="w-full h-24 p-3 border rounded-md text-sm"
                placeholder={`Examples:\n• "Block interns from asking about salary or compensation"\n• "Redact all emails and phone numbers from retrieved chunks"\n• "Require every answer to cite at least 2 sources with 0.8 confidence"\n• "Only let users see documents from their own department"`}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                disabled={aiGenerating}
              />
              {aiError && (
                <p className="text-sm text-red-600">{aiError}</p>
              )}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleAiGenerate}
                  disabled={!aiPrompt.trim() || aiGenerating}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Policy
                    </>
                  )}
                </Button>
                {aiGenerating && (
                  <p className="text-xs text-muted-foreground">This may take 10-30 seconds depending on your Ollama model...</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={mode} onValueChange={(v) => setMode(v as "visual" | "yaml")}>
          <TabsList>
            <TabsTrigger value="visual">Visual Builder</TabsTrigger>
            <TabsTrigger value="yaml">YAML Editor</TabsTrigger>
          </TabsList>
          <TabsContent value="visual" className="space-y-4">
            <Card className="border-blue-200 bg-blue-50/30">
              <CardContent className="py-4">
                <p className="text-sm font-medium mb-2">How a policy works — the big picture</p>
                <p className="text-xs text-muted-foreground">
                  A policy is a rule that enforces data governance at one stage of the RAG pipeline. Every user query flows through 4 stages:
                </p>
                <div className="flex items-center gap-2 my-2 text-xs font-mono">
                  <span className="px-2 py-1 bg-blue-100 rounded">Pre-Query</span>
                  <span>→</span>
                  <span className="px-2 py-1 bg-purple-100 rounded">Pre-Retrieval</span>
                  <span>→</span>
                  <span className="px-2 py-1 bg-amber-100 rounded">Post-Retrieval</span>
                  <span>→</span>
                  <span className="px-2 py-1 bg-green-100 rounded">Post-Generation</span>
                  <span>→ User sees answer</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Each policy has 5 parts: <strong>(1) Stage</strong> — when in the pipeline to check, <strong>(2) Conditions</strong> — who it applies to, <strong>(3) Match</strong> — what content to look for, <strong>(4) Action</strong> — what to do when triggered, <strong>(5) Distilled Prompt</strong> — optional soft LLM guidance. Fill in each section below.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Basic Information</CardTitle>
                <CardDescription>
                  Every policy enforces a rule at one specific stage of the RAG pipeline. A user query flows through 4 stages in order: Pre-Query, Pre-Retrieval, Post-Retrieval, Post-Generation. Choose the stage where your rule should be checked. The stage you pick determines what data is available for your conditions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Policy Name *</Label>
                    <Input value={policy.name} onChange={(e) => setPolicy({ ...policy, name: e.target.value })} placeholder="block-sensitive-queries" />
                    <p className="text-xs text-muted-foreground">A unique, descriptive name for this policy. Use kebab-case like &quot;block-intern-salary&quot; or &quot;redact-pii-from-chunks&quot;.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Stage *</Label>
                    <select className="w-full h-10 px-3 border rounded-md" value={policy.stage} onChange={(e) => setPolicy({ ...policy, stage: e.target.value as PolicyForm["stage"] })}>
                      <option value="pre_query">Pre-Query (before vector search)</option>
                      <option value="pre_retrieval">Pre-Retrieval (add filters)</option>
                      <option value="post_retrieval">Post-Retrieval (filter chunks)</option>
                      <option value="post_generation">Post-Generation (validate answer)</option>
                    </select>
                    <div className="text-xs text-muted-foreground space-y-1 mt-1">
                      <p className="font-medium">{getStageHelpText()}</p>
                      {policy.stage === "pre_query" && <p>Use this to block or flag dangerous queries before any documents are retrieved. Example: block interns from asking about salary data.</p>}
                      {policy.stage === "pre_retrieval" && <p>Use this to inject metadata filters that narrow which documents the vector DB returns. Example: restrict users to only their department&apos;s documents.</p>}
                      {policy.stage === "post_retrieval" && <p>Use this to redact PII or drop sensitive chunks after documents are retrieved but before the LLM sees them. Example: remove email addresses and phone numbers from retrieved text.</p>}
                      {policy.stage === "post_generation" && <p>Use this to validate the LLM&apos;s final answer before it reaches the user. Example: block answers without citations, or redact PII that leaked into the response.</p>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority (higher = evaluated first)</Label>
                    <Input type="number" value={policy.priority} onChange={(e) => setPolicy({ ...policy, priority: parseInt(e.target.value) || 0 })} />
                    <p className="text-xs text-muted-foreground">When multiple policies apply at the same stage, higher priority runs first. A blocking policy at priority 100 will stop the query before a priority 50 policy ever runs. Range: 0-100.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Labels (comma-separated)</Label>
                    <Input value={policy.labels} onChange={(e) => setPolicy({ ...policy, labels: e.target.value })} placeholder="attack, pii, hr" />
                    <p className="text-xs text-muted-foreground">Optional tags for organizing policies. Purely for your reference — does not affect enforcement. Example: &quot;pii, compliance&quot; or &quot;hr, sensitive&quot;.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Step 2: Conditions — WHO does this policy apply to?</CardTitle>
                <CardDescription>
                  Conditions control <strong>who</strong> triggers this policy, based on user attributes (role, department, clearance level) or request context. If the conditions don&apos;t match, the policy is silently skipped and the query proceeds as normal. Think of this as the &quot;audience filter&quot; — it answers: &quot;Which users should this rule apply to?&quot;
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Match Mode</Label>
                  <select className="w-full h-10 px-3 border rounded-md" value={policy.whenMode} onChange={(e) => setPolicy({ ...policy, whenMode: e.target.value as "any" | "all" | "none" })}>
                    <option value="any">ANY condition must be true (OR logic)</option>
                    <option value="all">ALL conditions must be true (AND logic)</option>
                    <option value="none">No conditions — applies to every user</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {policy.whenMode === "any" && "The policy triggers if at least one condition matches. Example: user is an intern OR user is a contractor."}
                    {policy.whenMode === "all" && "The policy triggers only if every condition matches. Example: user is an intern AND belongs to the HR department."}
                    {policy.whenMode === "none" && "The policy applies to every request regardless of who the user is. Use this for universal rules like 'always redact PII'."}
                  </p>
                </div>

                {policy.whenMode !== "none" && (
                  <div className="bg-muted/50 border rounded-md p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">How to build a condition:</p>
                    <p><strong>Field</strong> — The attribute to check. Start typing and pick from suggestions. Common fields: <code>user.role</code>, <code>user.department</code>, <code>user.clearance</code>.</p>
                    <p><strong>Operator</strong> — How to compare: <code>==</code> (exact match), <code>!=</code> (not equal), <code>contains</code> (substring), <code>in</code> (value is one of a comma-separated list).</p>
                    <p><strong>Value</strong> — The value to compare against. For <code>in</code>, provide a comma-separated list like &quot;intern, contractor, temp&quot;.</p>
                    <p className="mt-1 italic">Example: Field = <code>user.role</code>, Operator = <code>==</code>, Value = <code>intern</code> → policy applies only to interns.</p>
                  </div>
                )}

                {policy.conditions.map((cond, idx) => (
                  <div key={idx} className="flex gap-2 items-end p-4 border rounded-md">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div className="space-y-2">
                        <Label>Field</Label>
                        <Input value={cond.field} onChange={(e) => updateCondition(idx, { field: e.target.value })} placeholder="user.role" list={`field-suggestions-${idx}`} />
                        <datalist id={`field-suggestions-${idx}`}>
                          {getFieldSuggestions().map((field) => (<option key={field} value={field} />))}
                        </datalist>
                      </div>
                      <div className="space-y-2">
                        <Label>Operator</Label>
                        <select className="w-full h-10 px-3 border rounded-md" value={cond.operator} onChange={(e) => updateCondition(idx, { operator: e.target.value as any })}>
                          <option value="==">equals (==)</option>
                          <option value="!=">not equals (!=)</option>
                          <option value="contains">contains</option>
                          <option value="in">in list</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Value</Label>
                        <Input value={cond.value} onChange={(e) => updateCondition(idx, { value: e.target.value })} placeholder={getFieldExamples(cond.field) || "intern"} list={`value-examples-${idx}`} />
                        {getFieldExamples(cond.field) && (
                          <datalist id={`value-examples-${idx}`}>
                            {getFieldExamples(cond.field).split(",").map((ex) => ex.trim()).filter(Boolean).map((ex) => (<option key={ex} value={ex} />))}
                          </datalist>
                        )}
                      </div>
                    </div>
                    {policy.conditions.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeCondition(idx)} className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" onClick={addCondition} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Condition
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Step 3: Match — WHAT content does this policy check?</CardTitle>
                <CardDescription>
                  Match controls <strong>what content</strong> triggers the policy action. While &quot;Conditions&quot; above filters by user identity, Match filters by the actual content — the query text, chunk metadata, or answer fields. If both Conditions and Match are set, the user must match the Conditions AND the content must match here for the policy to fire.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 border rounded-md p-3 text-xs text-muted-foreground space-y-1 mb-2">
                  {policy.stage === "pre_query" && (
                    <>
                      <p className="font-medium">Pre-Query Match — Blocked Terms:</p>
                      <p>Set <strong>Match Field</strong> to <code>query.text</code> and enter keywords to block in <strong>Match Value</strong>. These become the &quot;blocked terms&quot; list. The system uses multi-layered detection (exact match, Unicode normalization, fuzzy matching for typos, and phonetic matching) to catch evasion attempts like &quot;s.a.l.a.r.y&quot;, &quot;salarry&quot;, or leetspeak &quot;$alary&quot;.</p>
                      <p className="italic">Example: Match Field = <code>query.text</code>, Match Value = <code>salary, compensation, CTC</code></p>
                    </>
                  )}
                  {policy.stage === "pre_retrieval" && (
                    <>
                      <p className="font-medium">Pre-Retrieval Match — Request Filters:</p>
                      <p>Match against request parameters to decide whether to inject additional vector DB filters. Typically used with <code>request.index</code> or <code>request.filters</code>.</p>
                      <p className="italic">Example: Match Field = <code>request.index</code>, Match Value = <code>hr-documents</code></p>
                    </>
                  )}
                  {policy.stage === "post_retrieval" && (
                    <>
                      <p className="font-medium">Post-Retrieval Match — Chunk Metadata:</p>
                      <p>Match against retrieved chunk metadata to decide which chunks to keep, drop, or redact. Use <code>chunk.tags_any</code> to match any tag, or <code>chunk.metadata.sensitivity</code> for sensitivity levels.</p>
                      <p className="italic">Example: Match Field = <code>chunk.metadata.sensitivity</code>, Match Value = <code>confidential</code></p>
                    </>
                  )}
                  {policy.stage === "post_generation" && (
                    <>
                      <p className="font-medium">Post-Generation Match — Answer Validation:</p>
                      <p>Match against the LLM&apos;s generated answer. Use <code>answer.text</code> to check for banned keywords in the response, or <code>answer.confidence</code> and <code>answer.citations</code> for quality enforcement.</p>
                      <p className="italic">Example: Match Field = <code>answer.text</code>, Match Value = <code>salary, SSN</code> (blocks answers that mention these words)</p>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Match Field</Label>
                    <Input value={policy.matchType} onChange={(e) => setPolicy({ ...policy, matchType: e.target.value })} placeholder={getMatchFieldsForStage()[0] || "e.g., query.text"} list="match-suggestions" />
                    <datalist id="match-suggestions">
                      {getMatchFieldsForStage().map((f) => (<option key={f} value={f} />))}
                    </datalist>
                    <p className="text-xs text-muted-foreground">Start typing to see suggestions. The available fields depend on the Stage selected above.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Match Value (comma-separated for list)</Label>
                    <Input
                      value={Array.isArray(policy.matchValue) ? policy.matchValue.join(", ") : policy.matchValue}
                      onChange={(e) => setPolicy({
                        ...policy,
                        matchValue: e.target.value.includes(",") ? e.target.value.split(",").map((s) => s.trim()) : e.target.value,
                      })}
                      placeholder='salary, PAN or ["salary", "PAN"]'
                    />
                    <p className="text-xs text-muted-foreground">Enter one or more values. Use commas to separate multiple terms. Leave empty to skip content matching (policy will fire based on Conditions alone).</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Step 4: Action — WHAT happens when the policy fires?</CardTitle>
                <CardDescription>
                  The action defines the enforcement outcome. When both Conditions (Step 2) and Match (Step 3) are satisfied, this action executes. Different actions are suited to different stages — the descriptions below guide you on which to use where.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Action Type</Label>
                  <select className="w-full h-10 px-3 border rounded-md" value={policy.actionType} onChange={(e) => setPolicy({ ...policy, actionType: e.target.value as PolicyForm["actionType"], actionConfig: {} })}>
                    <option value="block">Block — Reject the request entirely</option>
                    <option value="rewrite">Rewrite — Inject metadata filters into the retrieval request</option>
                    <option value="filter">Filter — Drop or keep specific document chunks</option>
                    <option value="redact">Redact — Mask PII patterns in text</option>
                    <option value="enforce">Enforce — Require citations or minimum confidence</option>
                  </select>
                  <div className="bg-muted/50 border rounded-md p-3 text-xs text-muted-foreground space-y-1 mt-1">
                    {policy.actionType === "block" && (
                      <>
                        <p className="font-medium">Block — Best for Pre-Query and Post-Generation stages.</p>
                        <p>Completely rejects the request and returns an error message to the user. At Pre-Query, this stops the query before any documents are retrieved. At Post-Generation, this discards the LLM&apos;s answer if it contains forbidden content.</p>
                        <p className="italic">Use case: &quot;Interns cannot ask about salary data&quot; or &quot;Block any answer that mentions SSN numbers.&quot;</p>
                      </>
                    )}
                    {policy.actionType === "rewrite" && (
                      <>
                        <p className="font-medium">Rewrite — Best for Pre-Retrieval stage.</p>
                        <p>Silently adds metadata filters to the vector DB search query. The user&apos;s question stays the same, but the documents returned are narrowed to only those matching the injected filters. Use <code>{`\${user.department}`}</code> syntax to dynamically insert user attributes.</p>
                        <p className="italic">Use case: &quot;Each user should only retrieve documents from their own department.&quot;</p>
                      </>
                    )}
                    {policy.actionType === "filter" && (
                      <>
                        <p className="font-medium">Filter — Best for Post-Retrieval stage.</p>
                        <p>After documents are retrieved, this action drops chunks that match <strong>Drop If</strong> conditions or keeps only those matching <strong>Keep If</strong>. Conditions are checked against each chunk&apos;s metadata tags and sensitivity level.</p>
                        <p className="italic">Use case: &quot;Drop all chunks tagged as confidential&quot; or &quot;Keep only public chunks for guest users.&quot;</p>
                      </>
                    )}
                    {policy.actionType === "redact" && (
                      <>
                        <p className="font-medium">Redact — Works at Post-Retrieval and Post-Generation stages.</p>
                        <p><strong>Patterns</strong> are named PII types that get masked with &quot;[REDACTED]&quot;. Supported patterns: <code>EMAIL</code>, <code>PHONE</code>, <code>SSN</code>, <code>PAN</code>, <code>AADHAAR</code>, <code>CREDIT_CARD</code>, <code>IP_ADDRESS</code>.</p>
                        <p><strong>Fields</strong> are metadata field names on chunks that should be blanked out entirely (e.g., remove <code>employee_name</code> from chunk metadata).</p>
                        <p className="italic">Use case: &quot;Mask all email addresses and phone numbers before the LLM sees the chunks.&quot;</p>
                      </>
                    )}
                    {policy.actionType === "enforce" && (
                      <>
                        <p className="font-medium">Enforce — Best for Post-Generation stage.</p>
                        <p>Validates quality of the LLM&apos;s answer. <strong>Min Citations</strong> requires the answer to reference at least N source documents. <strong>Min Confidence</strong> requires the LLM&apos;s self-reported confidence score to be above the threshold (0.0 to 1.0). If either check fails, the answer is blocked.</p>
                        <p className="italic">Use case: &quot;Every answer must cite at least 2 sources and have confidence above 0.7.&quot;</p>
                      </>
                    )}
                  </div>
                </div>

                {policy.actionType === "block" && (
                  <div className="space-y-2">
                    <Label>Block Message</Label>
                    <Input value={policy.actionConfig.message || ""} onChange={(e) => setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, message: e.target.value } })} placeholder="Restricted topic for your role." />
                    <p className="text-xs text-muted-foreground">This message is shown to the end user when their query is blocked. Keep it clear and non-revealing.</p>
                  </div>
                )}

                {policy.actionType === "rewrite" && (
                  <div className="space-y-2">
                    <Label>Add Filters (JSON)</Label>
                    <textarea className="w-full h-24 p-2 font-mono text-sm border rounded-md" value={JSON.stringify(policy.actionConfig.filters || {}, null, 2)}
                      onChange={(e) => { try { setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, filters: JSON.parse(e.target.value) } }); } catch {} }}
                      placeholder='{"department": "${user.department}"}' />
                    <p className="text-xs text-muted-foreground">JSON object of key-value filters injected into the vector DB query. Use <code>{`\${user.field}`}</code> to dynamically substitute user attributes.</p>
                  </div>
                )}

                {policy.actionType === "filter" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Keep If (JSON)</Label>
                      <textarea className="w-full h-24 p-2 font-mono text-sm border rounded-md" value={JSON.stringify(policy.actionConfig.keep_if || {}, null, 2)}
                        onChange={(e) => { try { setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, keep_if: JSON.parse(e.target.value) } }); } catch {} }}
                        placeholder='{"sensitivity": "public"}' />
                      <p className="text-xs text-muted-foreground">Only chunks with metadata matching these key-value pairs survive. Others are dropped.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Drop If (JSON)</Label>
                      <textarea className="w-full h-24 p-2 font-mono text-sm border rounded-md" value={JSON.stringify(policy.actionConfig.drop_if || {}, null, 2)}
                        onChange={(e) => { try { setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, drop_if: JSON.parse(e.target.value) } }); } catch {} }}
                        placeholder='{"sensitivity": "confidential"}' />
                      <p className="text-xs text-muted-foreground">Chunks with metadata matching these key-value pairs are removed before the LLM sees them.</p>
                    </div>
                  </div>
                )}

                {policy.actionType === "redact" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Patterns (comma-separated)</Label>
                      <Input value={Array.isArray(policy.actionConfig.patterns) ? policy.actionConfig.patterns.join(", ") : ""}
                        onChange={(e) => setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, patterns: e.target.value.split(",").map((s) => s.trim()) } })}
                        placeholder="EMAIL, PHONE, PAN" />
                      <p className="text-xs text-muted-foreground">Named PII types to detect and replace with [REDACTED]. Available: EMAIL, PHONE, SSN, PAN, AADHAAR, CREDIT_CARD, IP_ADDRESS.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Fields (comma-separated)</Label>
                      <Input value={Array.isArray(policy.actionConfig.fields) ? policy.actionConfig.fields.join(", ") : ""}
                        onChange={(e) => setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, fields: e.target.value.split(",").map((s) => s.trim()) } })}
                        placeholder="employee_name, amount" />
                      <p className="text-xs text-muted-foreground">Metadata field names on document chunks to blank out entirely (set to empty string).</p>
                    </div>
                  </div>
                )}

                {policy.actionType === "enforce" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Citations</Label>
                      <Input type="number" value={policy.actionConfig.citations?.min || 0}
                        onChange={(e) => setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, citations: { min: parseInt(e.target.value) || 0 } } })} />
                      <p className="text-xs text-muted-foreground">The LLM&apos;s answer must reference at least this many source documents. Set 0 to skip this check.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Min Confidence</Label>
                      <Input type="number" step="0.01" value={policy.actionConfig.min_confidence || 0}
                        onChange={(e) => setPolicy({ ...policy, actionConfig: { ...policy.actionConfig, min_confidence: parseFloat(e.target.value) || 0 } })} />
                      <p className="text-xs text-muted-foreground">The answer&apos;s confidence score must be at least this value (0.0 to 1.0). Set 0 to skip this check.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Step 5: Distilled Prompt — Soft guidance for the LLM</CardTitle>
                <CardDescription>
                  This is a natural-language instruction that gets injected into the LLM&apos;s system prompt at runtime. Unlike the hard rules above (which block/redact mechanically), this &quot;nudges&quot; the LLM to follow the spirit of the policy in its own words. The LLM reads this as part of its instructions when generating an answer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-muted/50 border rounded-md p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">When is this used?</p>
                  <p>The distilled prompt is collected from all policies whose Conditions (Step 2) match the current user. It is sent to the LLM as part of the system message, alongside the retrieved document chunks. This adds a layer of &quot;soft enforcement&quot; — even if the hard rules don&apos;t block the query, the LLM is instructed to be careful.</p>
                  <p className="font-medium mt-2">Tips for writing a good distilled prompt:</p>
                  <p>- Be specific and direct: <em>&quot;Do not reveal salary figures for named individuals&quot;</em> is better than <em>&quot;Be careful about sensitive topics.&quot;</em></p>
                  <p>- Frame it as a rule: <em>&quot;You must not disclose personal contact information such as phone numbers or email addresses.&quot;</em></p>
                  <p>- Keep it under 2 sentences. Long prompts dilute the LLM&apos;s attention.</p>
                  <p className="font-medium mt-2">This field is optional.</p>
                  <p>Leave it empty if the hard action (block/redact/filter) alone is sufficient and you don&apos;t need the LLM to adjust its behavior.</p>
                </div>
                <textarea className="w-full h-24 p-3 border rounded-md" value={policy.distilled_prompt} onChange={(e) => setPolicy({ ...policy, distilled_prompt: e.target.value })}
                  placeholder="Do not answer about compensation/salaries of specific individuals." />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="yaml">
            <Card>
              <CardHeader>
                <CardTitle>Generated YAML</CardTitle>
                <CardDescription>
                  This is the raw policy definition auto-generated from the Visual Builder. You can edit it directly here for advanced configurations (like setting a custom <code>fuzzy_threshold</code> for pre-query blocking). Changes here are saved as-is — the visual builder and YAML are independent views.
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
