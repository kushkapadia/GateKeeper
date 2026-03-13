import time

from fastapi import FastAPI, HTTPException, Header, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from .models.types import EnforcementRequest, EnforcementResponse
from .policies.repository import fetch_applicable_distilled_prompts
from .policies.context_builder import build_policy_context
from .policies.evaluator import evaluate
from .policies.validator import lint_policies
from .audit.logger import (
    configure_logging, record_audit, fetch_audit_logs,
    fetch_dashboard_stats, fetch_risky_users, fetch_recent_activity,
)
from mcp.server.main import policy_test
from .auth.auth import authenticate_tenant, create_jwt_token, verify_jwt_token

configure_logging()

app = FastAPI(title="GateKeeper Enforcement API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


def get_current_tenant(authorization: Optional[str] = Header(None)) -> dict:
    """Extract tenant from JWT token in Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.replace("Bearer ", "")
    payload = verify_jwt_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"id": payload["tenant_id"], "name": payload["tenant_name"]}


@app.post("/api/auth/login")
def login(payload: dict):
    """Authenticate tenant and return JWT token."""
    name = payload.get("name", "")
    password = payload.get("password", "")
    if not name or not password:
        raise HTTPException(status_code=400, detail="Name and password required")
    tenant = authenticate_tenant(name, password)
    if not tenant:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt_token(tenant["id"], tenant["name"])
    return {"token": token, "tenant": tenant}


@app.post("/v1/enforce", response_model=EnforcementResponse)
def enforce(req: EnforcementRequest) -> EnforcementResponse:
    t0 = time.perf_counter()
    decision, changes, trace = evaluate(
        req.stage, req.user, req.request, artifacts=req.artifacts,
    )
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

    prompts = fetch_applicable_distilled_prompts(req.stage, req.user, req.request)
    policy_context = build_policy_context(req.user, prompts, role_scope={"role": req.user.get("role"), "department": req.user.get("department")}) if prompts else None

    audit_id = record_audit(
        stage=req.stage,
        user=req.user,
        request=req.request,
        decision=decision,
        trace=trace,
        latency_ms=elapsed_ms,
        correlation_id=req.correlationId,
    )

    return EnforcementResponse(
        decision=decision,
        data=changes or {},
        auditId=audit_id,
        trace=trace,
        policyContext=policy_context,
    )


# Studio API endpoints
@app.post("/api/policies/generate")
async def generate_policy_endpoint(
    payload: dict,
    tenant: dict = Depends(get_current_tenant),
):
    from .policies.ai_generate import generate_policy
    from .policies.descriptor import fetch_descriptor

    description = payload.get("description", "").strip()
    if not description:
        raise HTTPException(status_code=400, detail="description is required")

    descriptor = fetch_descriptor(tenant["id"], payload.get("version", "v0"))
    model = payload.get("model", "llama3.1:8b")

    try:
        policy = await generate_policy(description, descriptor=descriptor, model=model)
        return {"ok": True, "policy": policy}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")


@app.post("/api/policies/lint")
def lint_policy_endpoint(payload: dict, tenant: dict = Depends(get_current_tenant)):
    descriptor_version = payload.get("descriptorVersion", "v0")
    policies = payload.get("policies", [])
    ok, errors, warnings = lint_policies(tenant["id"], descriptor_version, policies)
    return {"ok": ok, "errors": errors, "warnings": warnings}


@app.post("/api/policies/simulate")
def simulate_policy_endpoint(payload: dict):
    stage = payload.get("stage", "pre_query")
    user = payload.get("user", {})
    request_data = payload.get("request", {})
    artifacts = payload.get("artifacts")

    t0 = time.perf_counter()
    decision, changes, trace = evaluate(stage, user, request_data, artifacts=artifacts)
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

    prompts = fetch_applicable_distilled_prompts(stage, user, request_data)
    policy_context = (
        build_policy_context(user, prompts, role_scope={
            "role": user.get("role"),
            "department": user.get("department"),
        })
        if prompts
        else None
    )

    audit_id = record_audit(
        stage=stage,
        user=user,
        request=request_data,
        decision=decision,
        trace=trace,
        latency_ms=elapsed_ms,
        correlation_id="simulate",
    )

    return {
        "decision": decision,
        "data": changes or {},
        "trace": trace,
        "policyContext": policy_context,
        "metrics": {"latencyMs": elapsed_ms},
        "auditId": audit_id,
    }


@app.post("/api/policies/test")
def test_policy_endpoint(payload: dict):
    result = policy_test(payload)
    return result


@app.get("/api/policies")
def list_policies_endpoint(
    version: str = "v0",
    tenant: dict = Depends(get_current_tenant),
):
    from .policies.crud import list_policies
    policies = list_policies(tenant["id"], version)
    return {"policies": policies}


@app.post("/api/policies")
def create_policy_endpoint(
    payload: dict,
    tenant: dict = Depends(get_current_tenant),
):
    from .policies.crud import create_policy
    name = payload.get("name")
    stage = payload.get("stage")
    content = payload.get("content", {})
    if not name or not stage:
        raise HTTPException(status_code=400, detail="name and stage are required")
    policy = create_policy(
        tenant_id=tenant["id"],
        name=name,
        stage=stage,
        content=content,
        priority=payload.get("priority", 100),
        enabled=payload.get("enabled", True),
        distilled_prompt=payload.get("distilled_prompt", ""),
        labels=payload.get("labels"),
        version=payload.get("version", "v0"),
    )
    return {"ok": True, "policy": policy}


@app.get("/api/policies/{policy_id}")
def get_policy_endpoint(
    policy_id: str,
    version: str = "v0",
    tenant: dict = Depends(get_current_tenant),
):
    from .policies.crud import get_policy
    policy = get_policy(tenant["id"], policy_id, version)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return {"policy": policy}


@app.put("/api/policies/{policy_id}")
def update_policy_endpoint(
    policy_id: str,
    payload: dict,
    tenant: dict = Depends(get_current_tenant),
):
    from .policies.crud import update_policy
    updated = update_policy(
        tenant_id=tenant["id"],
        policy_id=policy_id,
        name=payload.get("name"),
        stage=payload.get("stage"),
        content=payload.get("content"),
        priority=payload.get("priority"),
        enabled=payload.get("enabled"),
        distilled_prompt=payload.get("distilled_prompt"),
        labels=payload.get("labels"),
        version=payload.get("version", "v0"),
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Policy not found")
    return {"ok": True, "policy": updated}


@app.delete("/api/policies/{policy_id}")
def delete_policy_endpoint(
    policy_id: str,
    tenant: dict = Depends(get_current_tenant),
):
    from .policies.crud import delete_policy
    deleted = delete_policy(tenant["id"], policy_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Policy not found")
    return {"ok": True}


@app.get("/api/dashboard/stats")
def dashboard_stats(window: int = Query(24, ge=1, le=720)):
    from .policies.crud import count_all_policies
    stats = fetch_dashboard_stats(window_hours=window)
    activity = fetch_recent_activity(limit=10)
    risky = fetch_risky_users(window_hours=window, limit=5)

    return {
        "policies": {"total": count_all_policies()},
        "enforcement": stats,
        "risky_users": risky,
        "recent_activity": activity,
    }


@app.get("/api/audit")
def get_audit_logs_endpoint(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    stage: Optional[str] = None,
    decision: Optional[str] = None,
):
    logs = fetch_audit_logs(limit=limit, offset=offset, stage=stage, decision=decision)
    return {"logs": logs, "count": len(logs)}


@app.get("/api/analytics/risky-users")
def get_risky_users_endpoint(window: int = Query(24, ge=1), limit: int = Query(10, ge=1)):
    users = fetch_risky_users(window_hours=window, limit=limit)
    return {"users": users}


@app.put("/api/schema/descriptor")
def update_descriptor(payload: dict, tenant: dict = Depends(get_current_tenant)):
    from .policies.descriptor import save_descriptor
    
    version = payload.get("version", "v0")
    content = payload.get("content", "")
    
    if not content:
        raise HTTPException(status_code=400, detail="Descriptor content is required")
    
    success = save_descriptor(tenant["id"], version, content)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save descriptor")
    
    return {"ok": True, "message": "Descriptor uploaded successfully"}


@app.get("/api/schema/descriptor")
def get_descriptor(version: str = "v0", tenant: dict = Depends(get_current_tenant)):
    from .policies.descriptor import fetch_descriptor
    
    desc = fetch_descriptor(tenant["id"], version)
    return {"descriptor": desc, "tenant": tenant, "version": version}

