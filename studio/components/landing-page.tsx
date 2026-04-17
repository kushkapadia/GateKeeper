"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  Shield, ArrowRight, ShieldAlert, Filter, EyeOff, Scale,
  AlertTriangle, Eye, Lock, FileSearch, BarChart3, TestTube,
  Users, Layers, Terminal, Check, X, Zap, Database,
  Fingerprint, GitBranch, Building2, Heart, Landmark, ChevronRight,
} from "lucide-react";
import { Orb } from "@/components/ui/orb";
import { CountUpNumber } from "@/components/ui/count-up";

/* ─── Animation variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };
const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" as const } },
};

function Section({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <motion.section
      id={id}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.section>
  );
}

function GlassCard({ children, className = "", hover = true }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`rounded-2xl border border-[#232336] bg-[#12121C]/80 backdrop-blur-sm ${hover ? "transition-all duration-300 hover:border-[#6C5CE7]/30 hover:shadow-[0_0_30px_rgba(108,92,231,0.06)] hover:-translate-y-0.5" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   1. NAVBAR
   ═══════════════════════════════════════════════════════════════ */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0B0B13]/90 backdrop-blur-md border-b border-[#232336]" : ""}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#6C5CE7]" />
          <span className="text-[15px] font-semibold text-white">GateKeeper</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {[{ label: "Features", href: "#features" }, { label: "Pipeline", href: "#pipeline" }, { label: "Use Cases", href: "#usecases" }].map((l) => (
            <a key={l.label} href={l.href} className="text-[13px] text-[#A1A1AA] hover:text-white transition-colors">{l.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-[13px] text-[#A1A1AA] hover:text-white transition-colors hidden sm:block">Sign In</Link>
          <Link href="/login" className="bg-[#6C5CE7] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#5A4BD1] transition-colors">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2. HERO
   ═══════════════════════════════════════════════════════════════ */

function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#0B0B13] flex items-center">
      {/* Orb bg */}
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2 }}>
        <Orb />
      </motion.div>
      {/* Noise */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
      }} />

      <div className="relative z-10 mx-auto max-w-6xl px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center min-h-screen py-32">
          {/* Left */}
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.h1 variants={fadeUp} className="text-[44px] sm:text-[54px] lg:text-[62px] font-bold text-white leading-[1.05] tracking-tight">
              Secure your AI
              <br />
              <span className="text-[#A29BFE]">before it speaks</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-6 text-[17px] text-[#A1A1AA] leading-relaxed max-w-lg">
              GateKeeper is a policy enforcement layer for RAG systems — controlling what gets asked, retrieved, and generated in real time.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/login" className="group inline-flex items-center gap-2 bg-[#6C5CE7] text-white text-[14px] font-semibold px-7 py-3.5 rounded-xl hover:bg-[#5A4BD1] transition-all shadow-[0_0_40px_rgba(108,92,231,0.25)]">
                Start Securing Your AI <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 text-[14px] text-[#A1A1AA] border border-[#232336] px-6 py-3.5 rounded-xl hover:border-[#6C5CE7]/40 hover:text-white transition-all">
                View Live Demo
              </Link>
            </motion.div>
          </motion.div>

          {/* Right — enforcement log */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" as const }}
            className="hidden lg:block"
          >
            <GlassCard className="p-0 overflow-hidden" hover={false}>
              <div className="flex items-center gap-2 px-5 py-3 border-b border-[#232336]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#232336]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#232336]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#232336]" />
                <span className="text-[11px] text-[#A1A1AA]/40 font-mono ml-2">enforcement.log</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-500/70">live</span>
                </div>
              </div>
              <div className="p-5 font-mono text-[12px] space-y-4">
                {/* Entry 1: blocked */}
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}>
                  <div className="text-[#A1A1AA]/30 mb-1">14:02:31 · pre_query</div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/[0.05] border border-red-500/10">
                    <X className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-white/60">&quot;What is the CEO&apos;s salary?&quot;</div>
                      <div className="text-red-400/80 mt-1 text-[11px]">BLOCKED <span className="text-[#A1A1AA]/25 ml-1">block-intern-salary · 8ms</span></div>
                    </div>
                  </div>
                </motion.div>
                {/* Entry 2: passed */}
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2 }}>
                  <div className="text-[#A1A1AA]/30 mb-1">14:02:34 · post_retrieval</div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/10">
                    <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-white/60">&quot;Show Q3 financial summary&quot;</div>
                      <div className="text-emerald-400/80 mt-1 text-[11px]">PASSED <span className="text-[#A1A1AA]/25 ml-1">2 chunks filtered · PII redacted · 14ms</span></div>
                    </div>
                  </div>
                </motion.div>
                {/* Entry 3: modified */}
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.6 }}>
                  <div className="text-[#A1A1AA]/30 mb-1">14:02:36 · post_generation</div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/10">
                    <EyeOff className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-white/60">&quot;Retrieve employee contact info&quot;</div>
                      <div className="text-amber-400/80 mt-1 text-[11px]">REDACTED <span className="text-[#A1A1AA]/25 ml-1">EMAIL ×2 · PHONE ×1 · 11ms</span></div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3. PROBLEM
   ═══════════════════════════════════════════════════════════════ */

function Problem() {
  const problems = [
    { icon: AlertTriangle, title: "Data Leakage", desc: "LLMs inadvertently expose PII, credentials, or classified information embedded in retrieved documents." },
    { icon: Lock, title: "Unauthorized Access", desc: "Users query data they shouldn't see. Without enforcement, every user has the same access to every document." },
    { icon: Eye, title: "Semantic Attacks", desc: "Prompt injection, jailbreaks, and obfuscated queries bypass simple keyword filters with ease." },
    { icon: FileSearch, title: "Zero Visibility", desc: "No audit trail, no trace, no way to know what was asked, what was returned, or what was leaked." },
  ];

  return (
    <Section className="bg-[#0B0B13] py-28 border-t border-[#232336]/50">
      <div className="mx-auto max-w-6xl px-6">
        <motion.p variants={fadeUp} className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#6C5CE7] mb-4">The Problem</motion.p>
        <motion.h2 variants={fadeUp} className="text-[32px] sm:text-[40px] font-bold text-white tracking-tight leading-tight max-w-2xl">
          AI is powerful.<br />But dangerously <span className="text-[#A29BFE]">ungoverned</span>.
        </motion.h2>
        <motion.div variants={fadeUp} className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((p) => (
            <GlassCard key={p.title} className="p-6">
              <div className="w-10 h-10 rounded-xl bg-[#6C5CE7]/10 flex items-center justify-center mb-4">
                <p.icon className="w-5 h-5 text-[#6C5CE7]" />
              </div>
              <h3 className="text-[15px] font-semibold text-white mb-2">{p.title}</h3>
              <p className="text-[13px] text-[#A1A1AA] leading-relaxed">{p.desc}</p>
            </GlassCard>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   4. PIPELINE — How it works
   ═══════════════════════════════════════════════════════════════ */

function Pipeline() {
  const stages = [
    { label: "Pre-Query", icon: ShieldAlert, desc: "Block unsafe inputs before any retrieval happens", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
    { label: "Pre-Retrieval", icon: Filter, desc: "Inject access filters to scope document retrieval", color: "text-[#6C5CE7]", bg: "bg-[#6C5CE7]/10", border: "border-[#6C5CE7]/20" },
    { label: "Post-Retrieval", icon: EyeOff, desc: "Redact PII and strip sensitive chunks", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    { label: "Post-Generation", icon: Scale, desc: "Enforce citations, confidence, and compliance", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  ];

  return (
    <Section id="pipeline" className="bg-[#0E0E18] py-28">
      <div className="mx-auto max-w-6xl px-6">
        <motion.p variants={fadeUp} className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#6C5CE7] mb-4">How It Works</motion.p>
        <motion.h2 variants={fadeUp} className="text-[32px] sm:text-[40px] font-bold text-white tracking-tight leading-tight max-w-2xl">
          Governance at <span className="text-[#A29BFE]">every stage</span> of the pipeline
        </motion.h2>

        {/* Pipeline flow */}
        <motion.div variants={fadeUp} className="mt-16">
          {/* Connector line */}
          <div className="hidden lg:block relative mb-6">
            <div className="absolute top-6 left-[calc(12.5%)] right-[calc(12.5%)] h-px bg-[#232336]" />
            <div className="flex justify-between px-[12.5%]">
              {stages.map((_, i) => (
                <div key={i} className="relative flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-[#232336] border-2 border-[#6C5CE7]/40 z-10" />
                  {i < stages.length - 1 && (
                    <ChevronRight className="absolute left-full top-0.5 ml-[calc(50%-8px)] w-4 h-4 text-[#232336] hidden xl:block" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stages.map((s) => (
              <motion.div key={s.label} variants={scaleIn}>
                <GlassCard className="p-6 h-full">
                  <div className={`w-10 h-10 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center mb-4`}>
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <h3 className="text-[15px] font-semibold text-white mb-2">{s.label}</h3>
                  <p className="text-[13px] text-[#A1A1AA] leading-relaxed">{s.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5. FEATURES
   ═══════════════════════════════════════════════════════════════ */

function Features() {
  const features = [
    { icon: Terminal, title: "Policy-as-Code", desc: "Define enforcement rules in structured YAML or through the visual builder." },
    { icon: Database, title: "Schema-Aware Validation", desc: "Policies validated against your descriptor — only valid fields and operators." },
    { icon: Zap, title: "Real-Time Enforcement", desc: "Sub-50ms evaluation. Policies execute inline, not as a post-hoc check." },
    { icon: BarChart3, title: "Full Audit Trail", desc: "Every decision logged with trace, latency, policy fired, and user context." },
    { icon: TestTube, title: "Simulator Testing", desc: "Test any policy against any user context before deploying to production." },
    { icon: Users, title: "Multi-Tenant", desc: "Isolated tenants, separate policies, independent schemas. Enterprise-ready." },
  ];

  return (
    <Section id="features" className="bg-[#0B0B13] py-28 border-t border-[#232336]/50">
      <div className="mx-auto max-w-6xl px-6">
        <motion.p variants={fadeUp} className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#6C5CE7] mb-4">Features</motion.p>
        <motion.h2 variants={fadeUp} className="text-[32px] sm:text-[40px] font-bold text-white tracking-tight max-w-xl">
          Built for <span className="text-[#A29BFE]">real-world</span> AI systems
        </motion.h2>
        <motion.div variants={fadeUp} className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <GlassCard key={f.title} className="p-6">
              <f.icon className="w-5 h-5 text-[#6C5CE7] mb-4" />
              <h3 className="text-[15px] font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-[13px] text-[#A1A1AA] leading-relaxed">{f.desc}</p>
            </GlassCard>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6. PRODUCT PREVIEW
   ═══════════════════════════════════════════════════════════════ */

function ProductPreview() {
  const panels = [
    {
      title: "Policy Editor",
      desc: "Visual builder with live preview",
      content: (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">block</span>
            <span className="text-white/50">block-intern-salary</span>
            <span className="text-[#A1A1AA]/30 ml-auto">priority: 100</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#0B0B13] border border-[#232336] font-mono text-[10px] text-[#A1A1AA]/60 space-y-1">
            <div><span className="text-[#6C5CE7]">when</span>: user.role == <span className="text-[#A29BFE]">&quot;intern&quot;</span></div>
            <div><span className="text-[#6C5CE7]">match</span>: query.text contains <span className="text-[#A29BFE]">&quot;salary&quot;</span></div>
            <div><span className="text-[#6C5CE7]">action</span>: <span className="text-red-400">block</span></div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">redact</span>
            <span className="text-white/50">redact-pii-chunks</span>
            <span className="text-[#A1A1AA]/30 ml-auto">priority: 90</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-[#6C5CE7]/10 text-[#6C5CE7] font-medium">rewrite</span>
            <span className="text-white/50">scope-department-docs</span>
            <span className="text-[#A1A1AA]/30 ml-auto">priority: 85</span>
          </div>
        </div>
      ),
    },
    {
      title: "Simulator",
      desc: "Test policies before shipping",
      content: (
        <div className="space-y-3">
          <div className="p-2.5 rounded-lg bg-[#0B0B13] border border-[#232336]">
            <div className="text-[10px] text-[#A1A1AA]/40 mb-1">Query</div>
            <div className="text-[11px] text-white/60">&quot;What is John&apos;s email address?&quot;</div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#A1A1AA]/40">
            <div className="flex-1 h-px bg-[#232336]" />
            <span>post_retrieval</span>
            <div className="flex-1 h-px bg-[#232336]" />
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/[0.04] border border-amber-500/10">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-semibold text-amber-400">REDACTED</span>
              <span className="text-[10px] text-[#A1A1AA]/30">11ms</span>
            </div>
            <div className="text-[11px] text-white/50">
              EMAIL → <span className="text-amber-400/60">[REDACTED]</span> · PHONE → <span className="text-amber-400/60">[REDACTED]</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Analytics",
      desc: "Real-time enforcement metrics",
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[{ l: "Blocked", v: "24", c: "text-red-400" }, { l: "Modified", v: "18", c: "text-amber-400" }, { l: "Allowed", v: "142", c: "text-emerald-400" }].map((s) => (
              <div key={s.l} className="p-2 rounded-lg bg-[#0B0B13] border border-[#232336] text-center">
                <div className={`text-[16px] font-bold ${s.c}`}>{s.v}</div>
                <div className="text-[9px] text-[#A1A1AA]/40">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-[3px] h-10">
            {[3, 5, 2, 7, 4, 8, 3, 6, 9, 5, 4, 7, 6, 8, 3, 5, 7, 4, 6, 8].map((v, i) => (
              <div key={i} className="flex-1 rounded-t-sm bg-[#6C5CE7]" style={{ height: `${v * 10}%`, opacity: 0.3 + v * 0.07 }} />
            ))}
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#A1A1AA]/30">
            <span>0h</span><span>12h</span><span>24h</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <Section className="bg-[#0E0E18] py-28 border-t border-[#232336]/50">
      <div className="mx-auto max-w-6xl px-6">
        <motion.p variants={fadeUp} className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#6C5CE7] mb-4">Product</motion.p>
        <motion.h2 variants={fadeUp} className="text-[32px] sm:text-[40px] font-bold text-white tracking-tight max-w-xl">
          See GateKeeper <span className="text-[#A29BFE]">in action</span>
        </motion.h2>
        <motion.div variants={fadeUp} className="mt-14 grid gap-4 lg:grid-cols-3">
          {panels.map((panel) => (
            <GlassCard key={panel.title} className="p-0 overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-[#232336]">
                <h3 className="text-[14px] font-semibold text-white">{panel.title}</h3>
                <p className="text-[12px] text-[#A1A1AA]/60 mt-0.5">{panel.desc}</p>
              </div>
              <div className="px-5 py-4">{panel.content}</div>
            </GlassCard>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   7. METRICS
   ═══════════════════════════════════════════════════════════════ */

function Metrics() {
  const stats = [
    { value: 99, suffix: "%", label: "Reduction in data leakage" },
    { prefix: "<", value: 50, suffix: "ms", label: "Latency overhead" },
    { value: 850, suffix: "+", label: "Requests per second" },
    { value: 70, suffix: "%", label: "Faster policy creation" },
  ];

  return (
    <Section className="bg-[#0B0B13] py-24 border-t border-[#232336]/50">
      <div className="mx-auto max-w-6xl px-6">
        <motion.p variants={fadeUp} className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#6C5CE7] mb-4 text-center">Impact</motion.p>
        <motion.h2 variants={fadeUp} className="text-[28px] sm:text-[36px] font-bold text-white tracking-tight text-center mb-16">
          Performance that <span className="text-[#A29BFE]">scales</span>
        </motion.h2>
        <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-[40px] sm:text-[48px] font-bold text-white tracking-tight">
                {s.prefix}<CountUpNumber to={s.value} duration={1.5} />{s.suffix}
              </div>
              <div className="text-[13px] text-[#A1A1AA] mt-1">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   8. USE CASES
   ═══════════════════════════════════════════════════════════════ */

function UseCases() {
  const cases = [
    { icon: Heart, title: "Healthcare", desc: "Protect patient records and PHI from leaking through AI-generated responses.", tag: "HIPAA" },
    { icon: Landmark, title: "Finance", desc: "Prevent confidential deal terms, compensation data, and trading strategies from exposure.", tag: "SOC 2" },
    { icon: Building2, title: "Enterprise", desc: "Enforce role-based access across departments, clearance levels, and data classifications.", tag: "RBAC" },
  ];

  return (
    <Section id="usecases" className="bg-[#0E0E18] py-28 border-t border-[#232336]/50">
      <div className="mx-auto max-w-6xl px-6">
        <motion.p variants={fadeUp} className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#6C5CE7] mb-4">Use Cases</motion.p>
        <motion.h2 variants={fadeUp} className="text-[32px] sm:text-[40px] font-bold text-white tracking-tight max-w-xl">
          Designed for <span className="text-[#A29BFE]">high-stakes</span> environments
        </motion.h2>
        <motion.div variants={fadeUp} className="mt-14 grid gap-4 lg:grid-cols-3">
          {cases.map((c) => (
            <GlassCard key={c.title} className="p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#6C5CE7]/10 flex items-center justify-center">
                  <c.icon className="w-5 h-5 text-[#6C5CE7]" />
                </div>
                <span className="text-[10px] font-semibold text-[#A1A1AA]/30 tracking-wider">{c.tag}</span>
              </div>
              <h3 className="text-[17px] font-semibold text-white mb-2">{c.title}</h3>
              <p className="text-[13px] text-[#A1A1AA] leading-relaxed">{c.desc}</p>
            </GlassCard>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   9. TRUST / SECURITY
   ═══════════════════════════════════════════════════════════════ */

function Trust() {
  const items = [
    { icon: BarChart3, label: "Complete audit logs" },
    { icon: Layers, label: "Deterministic policies" },
    { icon: Users, label: "Tenant isolation" },
    { icon: GitBranch, label: "Version-controlled schemas" },
    { icon: Lock, label: "Role-based access" },
    { icon: Fingerprint, label: "Full request tracing" },
  ];

  return (
    <Section className="bg-[#0B0B13] py-24 border-t border-[#232336]/50">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <motion.p variants={fadeUp} className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#6C5CE7] mb-4">Security</motion.p>
        <motion.h2 variants={fadeUp} className="text-[28px] sm:text-[36px] font-bold text-white tracking-tight mb-14">
          Built for <span className="text-[#A29BFE]">compliance</span> and control
        </motion.h2>
        <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-4 rounded-xl border border-[#232336] bg-[#12121C]/50">
              <item.icon className="w-4 h-4 text-[#6C5CE7] flex-shrink-0" />
              <span className="text-[13px] text-white/80">{item.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   10. FINAL CTA
   ═══════════════════════════════════════════════════════════════ */

function FinalCTA() {
  return (
    <Section className="relative bg-[#0E0E18] py-28 border-t border-[#232336]/50 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#6C5CE7]/[0.08] rounded-full blur-[150px]" />
      </div>
      <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
        <motion.h2 variants={fadeUp} className="text-[32px] sm:text-[42px] font-bold text-white tracking-tight leading-tight">
          Don&apos;t ship AI without <span className="text-[#A29BFE]">governance</span>
        </motion.h2>
        <motion.p variants={fadeUp} className="mt-4 text-[16px] text-[#A1A1AA] max-w-md mx-auto">
          Define policies, connect your RAG stack, start enforcing. Takes minutes, not months.
        </motion.p>
        <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/login" className="group inline-flex items-center gap-2 bg-[#6C5CE7] text-white text-[14px] font-semibold px-8 py-3.5 rounded-xl hover:bg-[#5A4BD1] transition-all shadow-[0_0_50px_rgba(108,92,231,0.3)]">
            Get Started <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 text-[14px] text-[#A1A1AA] border border-[#232336] px-7 py-3.5 rounded-xl hover:border-[#6C5CE7]/40 hover:text-white transition-all">
            View Demo
          </Link>
        </motion.div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="bg-[#0B0B13] border-t border-[#232336] py-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#6C5CE7]" />
          <span className="text-[13px] font-medium text-white">GateKeeper</span>
        </div>
        <p className="text-[12px] text-[#A1A1AA]/40">&copy; {new Date().getFullYear()} GateKeeper. All rights reserved.</p>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0B0B13] text-white">
      <Nav />
      <Hero />
      <Problem />
      <Pipeline />
      <Features />
      <ProductPreview />
      <Metrics />
      <UseCases />
      <Trust />
      <FinalCTA />
      <Footer />
    </div>
  );
}
