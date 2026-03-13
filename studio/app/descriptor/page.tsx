"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDescriptorStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiCall } from "@/lib/api";
import { Upload, FileCode } from "lucide-react";

export default function DescriptorPage() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setHasDescriptor = useDescriptorStore((state) => state.setHasDescriptor);
  const router = useRouter();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/80 p-8">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-indigo-50">
                <FileCode className="w-5 h-5 text-indigo-600" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-900">Upload Schema Descriptor</CardTitle>
            </div>
            <CardDescription>
              This is a required first step. Upload your schema.yaml file to define valid attributes
              and metadata fields for your RAG pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="file" className="text-slate-700">Schema File (YAML)</Label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm text-slate-500 mb-2">Click to upload or drag your .yaml file here</p>
                  <Input
                    id="file"
                    type="file"
                    accept=".yaml,.yml"
                    onChange={handleFileUpload}
                    required
                    className="max-w-xs mx-auto"
                  />
                </div>
              </div>
              {content && (
                <div className="space-y-2">
                  <Label className="text-slate-700">Preview</Label>
                  <pre className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-sm overflow-auto max-h-96 font-mono text-slate-700">
                    {content}
                  </pre>
                </div>
              )}
              {error && (
                <div className="px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/25"
                size="lg"
                disabled={loading || !content}
              >
                {loading ? "Uploading..." : "Upload & Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
