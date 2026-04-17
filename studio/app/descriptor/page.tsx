"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useDescriptorStore } from "@/lib/store";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiCall } from "@/lib/api";
import { Upload, FileCode, CheckCircle2, AlertCircle } from "lucide-react";

export default function DescriptorPage() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const setHasDescriptor = useDescriptorStore((state) => state.setHasDescriptor);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const router = useRouter();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiCall("/api/schema/descriptor", {
        method: "PUT",
        body: JSON.stringify({ version: "v0", content }),
      });
      setHasDescriptor(true);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to upload descriptor");
    } finally {
      setLoading(false);
    }
  };

  const highlightYaml = (text: string) => {
    return text.split('\n').map((line) => {
      let h = line;
      h = h.replace(/^(\s*)([\w_-]+)(:)/g, '$1<span class="text-primary">$2</span><span class="text-muted-foreground">$3</span>');
      h = h.replace(/"([^"]*)"/g, '<span class="text-emerald-500 dark:text-emerald-400">"$1"</span>');
      h = h.replace(/(#.*)$/g, '<span class="text-muted-foreground/50">$1</span>');
      h = h.replace(/\b(true|false)\b/g, '<span class="text-amber-500">$1</span>');
      h = h.replace(/\b(\d+)\b/g, '<span class="text-accent-foreground">$1</span>');
      return h;
    }).join('\n');
  };

  const inner = (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileCode className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Upload Schema Descriptor</CardTitle>
              <CardDescription className="text-[12px]">
                Required first step. Define valid attributes and metadata fields.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-[12px]">Schema File (YAML)</Label>
              <div className="relative border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/30 hover:bg-primary/[0.02] transition-colors cursor-pointer">
                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-1">
                  {fileName ? (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-foreground font-medium">{fileName}</span>
                    </span>
                  ) : (
                    "Click to upload or drag your .yaml file"
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground/60">Supports .yaml and .yml</p>
                <Input
                  id="file"
                  type="file"
                  accept=".yaml,.yml"
                  onChange={handleFileUpload}
                  required
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {content && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[12px]">Preview</Label>
                  <span className="text-[10px] text-muted-foreground font-mono">{content.split('\n').length} lines</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-border">
                  <div className="flex items-center gap-2 px-4 py-2 bg-secondary border-b border-border">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20" />
                      <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20" />
                      <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20" />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{fileName || "schema.yaml"}</span>
                  </div>
                  <div className="flex">
                    <div className="py-3 px-3 select-none border-r border-border bg-secondary/50">
                      {content.split('\n').map((_, i) => (
                        <div key={i} className="text-[11px] font-mono text-muted-foreground/30 leading-5 text-right" style={{ minWidth: '24px' }}>
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    <pre className="flex-1 p-3 text-[11px] overflow-auto max-h-72 font-mono text-foreground leading-5 bg-card"
                      dangerouslySetInnerHTML={{ __html: highlightYaml(content) }}
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10"
              disabled={loading || !content}
            >
              {loading ? "Uploading..." : "Upload & Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );

  if (isAuthenticated) {
    return <DashboardLayout>{inner}</DashboardLayout>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      {inner}
    </div>
  );
}
