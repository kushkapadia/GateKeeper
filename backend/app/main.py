from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from .models.types import EnforcementRequest, EnforcementResponse
from .policies.repository import fetch_applicable_distilled_prompts
from .policies.context_builder import build_policy_context
from .policies.evaluator import evaluate

app = FastAPI(title="GateKeeper Enforcement API", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/v1/enforce", response_model=EnforcementResponse)
def enforce(req: EnforcementRequest) -> EnforcementResponse:
    # Stub enforcement: echo back with allowed decision
    # Evaluate basic policies (block/rewrite) and get changes
    decision, changes, trace = evaluate(req.stage, req.user, req.request)

    # Build distilled policy context for LLM prompt
    prompts = fetch_applicable_distilled_prompts(req.stage, req.user, req.request)
    policy_context = build_policy_context(req.user, prompts, role_scope={"role": req.user.get("role"), "department": req.user.get("department")}) if prompts else None

    return EnforcementResponse(
        decision=decision,
        data=changes or {},
        auditId="audit-stub",
        trace=trace,
        policyContext=policy_context,
    )


