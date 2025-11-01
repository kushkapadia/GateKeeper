"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDescriptorStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiCall } from "@/lib/api";

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
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:8000/api/schema/descriptor", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          version: "v0",
          content: content,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to upload descriptor");
      }
      
      const result = await response.json();
      setHasDescriptor(true);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to upload descriptor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl">Upload Schema Descriptor</CardTitle>
            <CardDescription>
              This is a required first step. Upload your schema.yaml file to define valid attributes
              and metadata fields.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="file">Schema File (YAML)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".yaml,.yml"
                  onChange={handleFileUpload}
                  required
                />
              </div>
              {content && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96">
                    {content}
                  </pre>
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" size="lg" disabled={loading || !content}>
                {loading ? "Uploading..." : "Upload & Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

