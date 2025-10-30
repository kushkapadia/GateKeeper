Research paper angle (suggested structure)
Problem: “Policy-as-code for RAG safety” and the gap between app logic and governance.
Design: Formalize the four-hook model and your policy schema; define conflict resolution and short-circuit semantics.
Method: Evaluate on representative workloads:
Security efficacy: PII leakage rate before/after; access violations prevented.
Answer quality: citation compliance and confidence gating effect.
Performance: added latency per hook and per action.
Operability: time-to-author and error rates with/without MCP tooling (user study or expert feedback).
Results:
Quantify reductions in unsafe responses and leakage.
Latency overhead breakdown per action type.
Usability benefits from MCP-based tooling (e.g., fewer authoring errors, faster iteration).
Discussion: Trade-offs (deny-overrides vs allow-overrides, redaction vs degradation), limitations (LLM-based PII), threat model (bypass risk), and future work (signed policies, NER microservice, NL→policy improvements).
Artifacts: Open policy corpus, schema, evaluation scripts, and an ablation showing MCP tooling vs no tooling.
Why this is a strong FYP
Real enterprise need; clear, defensible architecture.
Clean separation: low-latency enforcement vs human/CI tooling via MCP.
Easy to demo and measure.
Naturally produces a publishable evaluation and artifacts.


“GateKeeper provides a thin Python SDK that wraps the enforcement API into a simple function call enforce(stage, user_ctx, data). This allows developers to integrate policy checks into any RAG pipeline with a single import — similar to how developers use an npm or pip package.”