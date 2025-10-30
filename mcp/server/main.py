# MCP tools: policy:lint, policy:test, policy:simulate
from backend.app.policies.validator import lint_policies


def policy_test(payload: dict) -> dict:
    return {"summary": {"total": 0, "passed": 0, "failed": 0}, "results": []}


def policy_simulate(payload: dict) -> dict:
    return {"decision": "allowed", "dataAfter": {}, "trace": [], "metrics": {"latencyMs": 0.0}}


def policy_lint(payload: dict) -> dict:
    tenant = payload.get("tenant", "acme")
    descriptor_version = payload.get("descriptorVersion", "v0")
    policies = payload.get("policies", [])
    ok, errors, warnings = lint_policies(tenant, descriptor_version, policies)
    return {"ok": ok, "errors": errors, "warnings": warnings}


