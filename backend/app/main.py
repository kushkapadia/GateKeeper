from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .models.types import EnforcementRequest, EnforcementResponse
from .policies.repository import fetch_applicable_distilled_prompts
from .policies.context_builder import build_policy_context
from .policies.evaluator import evaluate
from .policies.validator import lint_policies
from mcp.server.main import policy_test, policy_simulate
from .auth.auth import authenticate_tenant, create_jwt_token, verify_jwt_token
from fastapi import Header, Depends
from typing import Optional

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


# Studio API endpoints
@app.post("/api/policies/lint")
def lint_policy_endpoint(payload: dict):
    tenant = payload.get("tenant", "acme")
    descriptor_version = payload.get("descriptorVersion", "v0")
    policies = payload.get("policies", [])
    ok, errors, warnings = lint_policies(tenant, descriptor_version, policies)
    return {"ok": ok, "errors": errors, "warnings": warnings}


@app.post("/api/policies/simulate")
def simulate_policy_endpoint(payload: dict):
    result = policy_simulate(payload)
    return result


@app.post("/api/policies/test")
def test_policy_endpoint(payload: dict):
    result = policy_test(payload)
    return result


@app.get("/api/policies")
def list_policies(tenant: str = "acme"):
    # TODO: Fetch from DB
    return {"policies": []}


@app.get("/api/analytics/risky-users")
def get_risky_users(window: str = "24h", limit: int = 10):
    # TODO: Fetch from Redis/DB
    return {"users": []}


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

