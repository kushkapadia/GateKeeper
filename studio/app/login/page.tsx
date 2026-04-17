"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ArrowRight } from "lucide-react";
import { Orb } from "@/components/ui/orb";

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
      {/* Left panel — purple */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#6C5CE7] relative overflow-hidden flex-col justify-between p-10">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-60" />
        {/* Lighter purple ambient glow */}
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-[#A29BFE]/30 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#5A4BD1]/30 rounded-full blur-[80px]" />

        {/* Orb */}
        <div className="absolute inset-0 opacity-25">
          <Orb />
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[14px] font-semibold text-white">GateKeeper</span>
        </div>

        <div className="relative z-10 space-y-5">
          <h1 className="text-3xl font-bold text-white leading-snug">
            AI Governance<br />for Enterprise RAG
          </h1>
          <p className="text-sm text-white/60 max-w-sm leading-relaxed">
            Block dangerous queries, redact PII, enforce citations, and control document access through a 4-stage policy layer.
          </p>
          <div className="flex items-center gap-1.5">
            {["Pre-Query", "Retrieval", "Post-Retrieval", "Generation"].map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className="px-2.5 py-1 text-[10px] font-medium rounded bg-white/10 text-white/70 border border-white/10">
                  {s}
                </span>
                {i < 3 && <span className="text-white/30 text-[10px]">→</span>}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[10px] text-white/30">Enterprise AI Governance</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-[340px] space-y-6">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[14px] font-semibold text-foreground">GateKeeper</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Welcome back</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Sign in to manage your policies</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[12px]">Tenant Name</Label>
              <Input id="name" type="text" placeholder="acme" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[12px]">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && (
              <div className="px-3 py-2 text-[13px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg">
                {error}
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <ArrowRight className="w-3.5 h-3.5 ml-1.5" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
