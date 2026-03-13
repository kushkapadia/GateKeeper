"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const success = await login(username, password);
    setLoading(false);
    if (success) {
      router.push("/dashboard");
    } else {
      setError("Invalid credentials. Please check your tenant name and password.");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500">
            <Shield className="w-5 h-5" />
          </div>
          <span className="text-xl font-semibold tracking-tight">GateKeeper</span>
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Policy enforcement<br />for your RAG pipeline
          </h1>
          <p className="text-lg text-indigo-200/70 max-w-md">
            Block dangerous queries, redact PII, enforce citations, and control document access — all through a pluggable policy layer.
          </p>
          <div className="flex gap-3">
            {["Pre-Query", "Pre-Retrieval", "Post-Retrieval", "Post-Generation"].map((s) => (
              <span key={s} className="px-3 py-1.5 text-xs font-medium rounded-full bg-white/10 text-indigo-200 border border-white/10">
                {s}
              </span>
            ))}
          </div>
        </div>
        <p className="text-sm text-slate-500">4-stage RAG governance</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/80">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-500 text-white">
                <Shield className="w-4.5 h-4.5" />
              </div>
              <span className="text-lg font-semibold">GateKeeper</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500">
              Sign in to your tenant to manage policies
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-700">Tenant Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="acme"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-11 bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 bg-white border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20"
              />
            </div>
            {error && (
              <div className="px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
                {error}
              </div>
            )}
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 transition-all"
            >
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
