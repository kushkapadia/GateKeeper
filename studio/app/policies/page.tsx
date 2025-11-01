"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, AlertCircle } from "lucide-react";

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
  const [mode, setMode] = useState<"visual" | "yaml">("visual");
  const [policy, setPolicy] = useState<PolicyForm>({
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
  });
  const [yamlOutput, setYamlOutput] = useState("");
  const [lintErrors, setLintErrors] = useState<string[]>([]);
  const [descriptor, setDescriptor] = useState<Descriptor | null>(null);
  const [loadingDescriptor, setLoadingDescriptor] = useState(true);

  // Fetch descriptor on mount
  useEffect(() => {
    const fetchDescriptor = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch("http://localhost:8000/api/schema/descriptor?version=v0", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setDescriptor(data.descriptor || {});
        }
      } catch (err) {
        console.error("Failed to fetch descriptor:", err);
      } finally {
        setLoadingDescriptor(false);
      }
    };
    fetchDescriptor();
  }, []);

  // Generate YAML from form
  useEffect(() => {
    if (mode === "yaml" && policy.name) {
      generateYAML();
    }
  }, [policy, mode]);

  // Build stage-aware field suggestions
  const getFieldSuggestions = (): string[] => {
    const fields: string[] = [];
    
    // User attributes available in all stages
    if (descriptor?.user_attributes) {
      descriptor.user_attributes.forEach((attr) => {
        fields.push(`user.${attr.name}`);
      });
    }
    
    // Stage-specific fields
    if (policy.stage === "pre_query") {
      // Only user context and query text available
      fields.push("query.text", "query.intent");
      // NO doc.metadata here - documents not retrieved yet
    } else if (policy.stage === "pre_retrieval") {
      // User context + request parameters
      fields.push("request.filters", "request.top_k", "request.index");
      // NO doc.metadata here - documents not retrieved yet
    } else if (policy.stage === "post_retrieval") {
      // User context + document metadata (now available)
      fields.push("chunk.tags", "chunk.text", "chunk.metadata.sensitivity");
      if (descriptor?.doc_metadata) {
        descriptor.doc_metadata.forEach((meta) => {
          fields.push(`chunk.metadata.${meta.name}`);
        });
      }
    } else if (policy.stage === "post_generation") {
      // User context + answer metadata
      fields.push("answer.text", "answer.citations", "answer.confidence", "answer.tokens");
      // Can also check doc metadata if referenced
      if (descriptor?.doc_metadata) {
        descriptor.doc_metadata.forEach((meta) => {
          fields.push(`answer.sources.metadata.${meta.name}`);
        });
      }
    }
    
    return fields;
  };

  // Get examples for a field (including stage-specific fields)
  const getFieldExamples = (fieldPath: string): string => {
    if (!descriptor) {
      // Provide default examples for stage-specific fields even without descriptor
      if (fieldPath === "query.text") return "salary, CEO compensation, PAN";
      if (fieldPath === "query.intent") return "retrieval, question, command";
      if (fieldPath === "request.top_k") return "5, 10, 20";
      if (fieldPath === "chunk.metadata.sensitivity") return "public, restricted, confidential";
      if (fieldPath === "answer.confidence") return "0.5, 0.7, 0.9";
      return "";
    }
    
    const parts = fieldPath.split(".");
    let exampleStr = "";
    if (parts[0] === "user" && parts.length === 2) {
      const attr = descriptor.user_attributes?.find((a) => a.name === parts[1]);
      exampleStr = attr?.example || "";
    } else if ((parts[0] === "doc" || parts[0] === "chunk") && parts[1] === "metadata" && parts.length === 3) {
      const meta = descriptor.doc_metadata?.find((m) => m.name === parts[2]);
      exampleStr = meta?.example || "";
    } else if (fieldPath === "query.text") {
      return "salary, CEO compensation, PAN, patient data";
    } else if (fieldPath === "query.intent") {
      return "retrieval, question, command";
    } else if (fieldPath === "request.top_k") {
      return "5, 10, 20";
    } else if (fieldPath === "chunk.metadata.sensitivity") {
      return "public, restricted, confidential";
    } else if (fieldPath === "answer.confidence") {
      return "0.5, 0.7, 0.9";
    }
    
    // Parse JSON arrays if present (e.g., ["salary", "policy"] -> salary, policy)
    if (exampleStr.startsWith("[") && exampleStr.endsWith("]")) {
      try {
        const parsed = JSON.parse(exampleStr);
        return Array.isArray(parsed) ? parsed.join(", ") : exampleStr;
      } catch {
        return exampleStr;
      }
    }
    return exampleStr;
  };

  const generateYAML = () => {
    const when: any = {};
    if (policy.whenMode !== "none" && policy.conditions.length > 0) {
      const exprs = policy.conditions
        .filter((c) => c.field && c.value)
        .map((c) => {
          let expr = `${c.field}`;
          // Handle different operators
          if (c.operator === "==") {
            // Check if value looks like a number or boolean
            const numVal = Number(c.value);
            const isNumeric = !isNaN(numVal) && c.value.trim() !== "";
            if (isNumeric) {
              expr += ` == ${numVal}`;
            } else if (c.value === "true" || c.value === "false") {
              expr += ` == ${c.value}`;
            } else {
              expr += ` == "${c.value}"`;
            }
          } else if (c.operator === "!=") {
            const numVal = Number(c.value);
            const isNumeric = !isNaN(numVal) && c.value.trim() !== "";
            if (isNumeric) {
              expr += ` != ${numVal}`;
            } else if (c.value === "true" || c.value === "false") {
              expr += ` != ${c.value}`;
            } else {
              expr += ` != "${c.value}"`;
            }
          } else if (c.operator === "contains") {
            expr += `.contains("${c.value}")`;
          } else if (c.operator === "in") {
            // Parse comma-separated or JSON array
            let arr: string[] = [];
            if (c.value.startsWith("[") && c.value.endsWith("]")) {
              try {
                arr = JSON.parse(c.value);
              } catch {
                arr = c.value.split(",").map((s) => s.trim().replace(/"/g, ""));
              }
            } else {
              arr = c.value.split(",").map((s) => s.trim().replace(/"/g, ""));
            }
            expr += ` in [${arr.map((v) => `"${v}"`).join(", ")}]`;
          } else if (c.operator === "not_in") {
            let arr: string[] = [];
            if (c.value.startsWith("[") && c.value.endsWith("]")) {
              try {
                arr = JSON.parse(c.value);
              } catch {
                arr = c.value.split(",").map((s) => s.trim().replace(/"/g, ""));
              }
            } else {
              arr = c.value.split(",").map((s) => s.trim().replace(/"/g, ""));
            }
            expr += ` not in [${arr.map((v) => `"${v}"`).join(", ")}]`;
          } else if (c.operator === ">" || c.operator === "<" || c.operator === ">=" || c.operator === "<=") {
            const numVal = Number(c.value);
            if (!isNaN(numVal)) {
              expr += ` ${c.operator} ${numVal}`;
            } else {
              expr += ` ${c.operator} "${c.value}"`;
            }
          }
          return { expr };
        });

      if (exprs.length > 0) {
        when[policy.whenMode] = exprs;
      }
    }

    const match: any = {};
    if (policy.matchType && policy.matchValue) {
      if (Array.isArray(policy.matchValue)) {
        match[policy.matchType] = policy.matchValue;
      } else {
        match[policy.matchType] = policy.matchValue;
      }
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

    const yaml: any = {
      name: policy.name,
      stage: policy.stage,
      priority: policy.priority,
      enabled: policy.enabled,
    };

    if (Object.keys(when).length > 0) yaml.when = when;
    if (Object.keys(match).length > 0) yaml.match = match;
    yaml.action = action;
    if (policy.distilled_prompt) yaml.distilled_prompt = policy.distilled_prompt;

    const labels = policy.labels.split(",").filter((l) => l.trim());
    if (labels.length > 0) yaml.labels = labels;

    setYamlOutput(
      `name: ${yaml.name}\n` +
        `stage: ${yaml.stage}\n` +
        `priority: ${yaml.priority}\n` +
        `enabled: ${yaml.enabled}\n` +
        (yaml.when ? `when:\n  ${policy.whenMode}:\n${JSON.stringify(yaml.when[policy.whenMode], null, 4)
          .split("\n")
          .map((l) => "    " + l)
          .join("\n")}\n` : "") +
        (yaml.match ? `match:\n${JSON.stringify(yaml.match, null, 2)
          .split("\n")
          .map((l) => "  " + l)
          .join("\n")}\n` : "") +
        `action:\n${JSON.stringify(yaml.action, null, 2)
          .split("\n")
          .map((l) => "  " + l)
          .join("\n")}\n` +
        (yaml.distilled_prompt ? `distilled_prompt: "${yaml.distilled_prompt}"\n` : "")
    );
  };

  const addCondition = () => {
    setPolicy({
      ...policy,
      conditions: [...policy.conditions, { field: "user.role", operator: "==", value: "" }],
    });
  };

  const removeCondition = (idx: number) => {
    setPolicy({
      ...policy,
      conditions: policy.conditions.filter((_, i) => i !== idx),
    });
  };

  const updateCondition = (idx: number, updates: Partial<ConditionExpr>) => {
    const newConditions = [...policy.conditions];
    newConditions[idx] = { ...newConditions[idx], ...updates };
    // If field changed, populate examples in value field (only if value is empty)
    if (updates.field && !newConditions[idx].value) {
      const examples = getFieldExamples(updates.field);
      if (examples) {
        // Use first example as default value
        const firstExample = examples.split(",")[0].trim();
        newConditions[idx].value = firstExample.replace(/"/g, ""); // Remove quotes if present
      }
    }
    setPolicy({ ...policy, conditions: newConditions });
  };

  const handleLint = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/policies/lint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant: "acme",
          descriptorVersion: "v0",
          policies: [JSON.parse(yamlOutput.replace(/name: (.+)/, '"name": "$1"').replace(/stage: (.+)/, '"stage": "$1"'))],
        }),
      });
      const result = await response.json();
      if (result.errors?.length > 0) {
        setLintErrors(result.errors.map((e: any) => e.message || JSON.stringify(e)));
      } else {
        setLintErrors([]);
        alert("✓ Policy is valid!");
      }
    } catch (err: any) {
      setLintErrors([err.message]);
    }
  };

  const handleSave = async () => {
    generateYAML();
    // TODO: Call /api/policies to save
    alert("Saving policy... (TODO: wire to API)");
  };

  const getMatchFieldsForStage = () => {
    const baseFields: string[] = [];
    if (policy.stage === "pre_query") {
      baseFields.push("query.text", "query.intent");
    } else if (policy.stage === "pre_retrieval") {
      baseFields.push("request.filters", "request.top_k", "request.index");
    } else if (policy.stage === "post_retrieval") {
      baseFields.push("chunk.tags", "chunk.metadata.sensitivity");
      // Add descriptor-based doc metadata fields (only available after retrieval)
      if (descriptor?.doc_metadata) {
        descriptor.doc_metadata.forEach((meta) => {
          baseFields.push(`chunk.metadata.${meta.name}`);
        });
      }
    } else if (policy.stage === "post_generation") {
      baseFields.push("answer.text", "answer.citations", "answer.confidence", "answer.tokens");
    }
    return baseFields;
  };

  // Get stage-specific help text
  const getStageHelpText = () => {
    switch (policy.stage) {
      case "pre_query":
        return "Available: user attributes (role, department) + query text. Documents not retrieved yet.";
      case "pre_retrieval":
        return "Available: user attributes + request filters. Documents not retrieved yet.";
      case "post_retrieval":
        return "Available: user attributes + document metadata (tags, sensitivity, etc.) from retrieved chunks.";
      case "post_generation":
        return "Available: user attributes + answer metadata (citations, confidence, text).";
      default:
        return "";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Policy Editor</h1>
            <p className="text-muted-foreground mt-2">Create and manage enforcement policies</p>
            {loadingDescriptor && (
              <p className="text-xs text-muted-foreground mt-1">Loading descriptor...</p>
            )}
            {!loadingDescriptor && !descriptor && (
              <p className="text-xs text-destructive mt-1">
                No descriptor found. Upload a schema descriptor first.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleLint} disabled={!policy.name}>
              Lint
            </Button>
            <Button onClick={handleSave} disabled={!policy.name}>
              Save & Publish
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

        <Tabs value={mode} onValueChange={(v) => setMode(v as "visual" | "yaml")}>
          <TabsList>
            <TabsTrigger value="visual">Visual Builder</TabsTrigger>
            <TabsTrigger value="yaml">YAML Editor</TabsTrigger>
          </TabsList>
          <TabsContent value="visual" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Select the enforcement stage. This determines which fields are available for your policy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Policy Name *</Label>
                    <Input
                      value={policy.name}
                      onChange={(e) => setPolicy({ ...policy, name: e.target.value })}
                      placeholder="block-sensitive-queries"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stage *</Label>
                    <select
                      className="w-full h-10 px-3 border rounded-md"
                      value={policy.stage}
                      onChange={(e) => {
                        const newStage = e.target.value as PolicyForm["stage"];
                        setPolicy({ ...policy, stage: newStage });
                        // Clear match fields if switching to a stage where they're invalid
                        if (newStage === "pre_query" || newStage === "pre_retrieval") {
                          if (policy.matchType?.startsWith("chunk.") || policy.matchType?.startsWith("doc.")) {
                            setPolicy({ ...policy, matchType: "", matchValue: "" });
                          }
                        }
                      }}
                    >
                      <option value="pre_query">Pre-Query (before vector search)</option>
                      <option value="pre_retrieval">Pre-Retrieval (add filters)</option>
                      <option value="post_retrieval">Post-Retrieval (filter chunks)</option>
                      <option value="post_generation">Post-Generation (validate answer)</option>
                    </select>
                    <p className="text-xs text-muted-foreground">{getStageHelpText()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority (higher = evaluated first)</Label>
                    <Input
                      type="number"
                      value={policy.priority}
                      onChange={(e) => setPolicy({ ...policy, priority: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Labels (comma-separated)</Label>
                    <Input
                      value={policy.labels}
                      onChange={(e) => setPolicy({ ...policy, labels: e.target.value })}
                      placeholder="attack, pii, hr"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conditions (When)</CardTitle>
                <CardDescription>
                  Define when this policy applies. {getStageHelpText()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Match Mode</Label>
                  <select
                    className="w-full h-10 px-3 border rounded-md"
                    value={policy.whenMode}
                    onChange={(e) => setPolicy({ ...policy, whenMode: e.target.value as "any" | "all" | "none" })}
                  >
                    <option value="any">ANY condition must be true</option>
                    <option value="all">ALL conditions must be true</option>
                    <option value="none">No conditions (always applies)</option>
                  </select>
                </div>

                {policy.conditions.map((cond, idx) => (
                  <div key={idx} className="flex gap-2 items-end p-4 border rounded-md">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div className="space-y-2">
                        <Label>Field</Label>
                        <Input
                          value={cond.field}
                          onChange={(e) => updateCondition(idx, { field: e.target.value })}
                          placeholder="user.role"
                          list={`field-suggestions-${idx}`}
                        />
                        <datalist id={`field-suggestions-${idx}`}>
                          {getFieldSuggestions().map((field) => (
                            <option key={field} value={field} />
                          ))}
                        </datalist>
                        {/* Warning if user tries to use doc metadata in early stages */}
                        {policy.stage === "pre_query" && cond.field.startsWith("doc.") && (
                          <p className="text-xs text-destructive mt-1">
                            ⚠️ Document metadata is not available in pre_query stage
                          </p>
                        )}
                        {policy.stage === "pre_retrieval" && cond.field.startsWith("doc.") && (
                          <p className="text-xs text-destructive mt-1">
                            ⚠️ Document metadata is not available in pre_retrieval stage
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Operator</Label>
                        <select
                          className="w-full h-10 px-3 border rounded-md"
                          value={cond.operator}
                          onChange={(e) => updateCondition(idx, { operator: e.target.value as any })}
                        >
                          <option value="==">equals (==)</option>
                          <option value="!=">not equals (!=)</option>
                          <option value="contains">contains (substring)</option>
                          <option value="in">in list (array)</option>
                          <option value="not_in">not in list</option>
                          <option value=">">greater than (&gt;)</option>
                          <option value="<">less than (&lt;)</option>
                          <option value=">=">greater or equal (&gt;=)</option>
                          <option value="<=">less or equal (&lt;=)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Value</Label>
                        <Input
                          value={cond.value}
                          onChange={(e) => updateCondition(idx, { value: e.target.value })}
                          placeholder={
                            getFieldExamples(cond.field) || 'intern or ["HR", "Finance"]'
                          }
                          list={`value-examples-${idx}`}
                        />
                        {getFieldExamples(cond.field) && (
                          <datalist id={`value-examples-${idx}`}>
                            {getFieldExamples(cond.field)
                              .split(",")
                              .map((ex) => ex.trim())
                              .filter(Boolean)
                              .map((ex) => (
                                <option key={ex} value={ex} />
                              ))}
                          </datalist>
                        )}
                        {getFieldExamples(cond.field) && (
                          <p className="text-xs text-muted-foreground">
                            Examples: {getFieldExamples(cond.field)}
                          </p>
                        )}
                      </div>
                    </div>
                    {policy.conditions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCondition(idx)}
                        className="text-destructive"
                      >
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
                <CardTitle>Match (Optional)</CardTitle>
                <CardDescription>Match specific fields in the request/artifacts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Match Field</Label>
                    <Input
                      value={policy.matchType}
                      onChange={(e) => setPolicy({ ...policy, matchType: e.target.value })}
                      placeholder={getMatchFieldsForStage()[0] || "e.g., query.text"}
                      list="match-suggestions"
                    />
                    <datalist id="match-suggestions">
                      {getMatchFieldsForStage().map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                    <p className="text-xs text-muted-foreground">
                      Available: {getMatchFieldsForStage().slice(0, 3).join(", ")}
                      {getMatchFieldsForStage().length > 3 && " ..."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Match Value (comma-separated for list)</Label>
                    <Input
                      value={Array.isArray(policy.matchValue) ? policy.matchValue.join(", ") : policy.matchValue}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          matchValue: e.target.value.includes(",") ? e.target.value.split(",").map((s) => s.trim()) : e.target.value,
                        })
                      }
                      placeholder='salary, PAN or ["salary", "PAN"]'
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Action</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Action Type</Label>
                  <select
                    className="w-full h-10 px-3 border rounded-md"
                    value={policy.actionType}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        actionType: e.target.value as PolicyForm["actionType"],
                        actionConfig: {},
                      })
                    }
                  >
                    <option value="block">Block</option>
                    <option value="rewrite">Rewrite</option>
                    <option value="filter">Filter</option>
                    <option value="redact">Redact</option>
                    <option value="enforce">Enforce</option>
                  </select>
                </div>

                {policy.actionType === "block" && (
                  <div className="space-y-2">
                    <Label>Block Message</Label>
                    <Input
                      value={policy.actionConfig.message || ""}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          actionConfig: { ...policy.actionConfig, message: e.target.value },
                        })
                      }
                      placeholder="Restricted topic for your role."
                    />
                  </div>
                )}

                {policy.actionType === "rewrite" && (
                  <div className="space-y-2">
                    <Label>Add Filters (JSON)</Label>
                    <textarea
                      className="w-full h-24 p-2 font-mono text-sm border rounded-md"
                      value={JSON.stringify(policy.actionConfig.filters || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          setPolicy({
                            ...policy,
                            actionConfig: { ...policy.actionConfig, filters: JSON.parse(e.target.value) },
                          });
                        } catch {}
                      }}
                      placeholder='{"department": "${user.department}"}'
                    />
                  </div>
                )}

                {policy.actionType === "filter" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Keep If (JSON)</Label>
                      <textarea
                        className="w-full h-24 p-2 font-mono text-sm border rounded-md"
                        value={JSON.stringify(policy.actionConfig.keep_if || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            setPolicy({
                              ...policy,
                              actionConfig: { ...policy.actionConfig, keep_if: JSON.parse(e.target.value) },
                            });
                          } catch {}
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Drop If (JSON)</Label>
                      <textarea
                        className="w-full h-24 p-2 font-mono text-sm border rounded-md"
                        value={JSON.stringify(policy.actionConfig.drop_if || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            setPolicy({
                              ...policy,
                              actionConfig: { ...policy.actionConfig, drop_if: JSON.parse(e.target.value) },
                            });
                          } catch {}
                        }}
                      />
                    </div>
                  </div>
                )}

                {policy.actionType === "redact" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Patterns (comma-separated)</Label>
                      <Input
                        value={Array.isArray(policy.actionConfig.patterns) ? policy.actionConfig.patterns.join(", ") : ""}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            actionConfig: {
                              ...policy.actionConfig,
                              patterns: e.target.value.split(",").map((s) => s.trim()),
                            },
                          })
                        }
                        placeholder="EMAIL, PHONE, PAN"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fields (comma-separated)</Label>
                      <Input
                        value={Array.isArray(policy.actionConfig.fields) ? policy.actionConfig.fields.join(", ") : ""}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            actionConfig: {
                              ...policy.actionConfig,
                              fields: e.target.value.split(",").map((s) => s.trim()),
                            },
                          })
                        }
                        placeholder="employee_name, amount"
                      />
                    </div>
                  </div>
                )}

                {policy.actionType === "enforce" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Citations</Label>
                      <Input
                        type="number"
                        value={policy.actionConfig.citations?.min || 0}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            actionConfig: {
                              ...policy.actionConfig,
                              citations: { min: parseInt(e.target.value) || 0 },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Confidence</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={policy.actionConfig.min_confidence || 0}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            actionConfig: { ...policy.actionConfig, min_confidence: parseFloat(e.target.value) || 0 },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distilled Prompt (for LLM)</CardTitle>
                <CardDescription>
                  Human-readable rule text that will be sent to the LLM as part of the system prompt
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full h-24 p-3 border rounded-md"
                  value={policy.distilled_prompt}
                  onChange={(e) => setPolicy({ ...policy, distilled_prompt: e.target.value })}
                  placeholder="Do not answer about compensation/salaries of specific individuals."
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="yaml">
            <Card>
              <CardHeader>
                <CardTitle>Generated YAML</CardTitle>
                <CardDescription>This YAML is auto-generated from the visual builder</CardDescription>
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
