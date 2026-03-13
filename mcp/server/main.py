# MCP tools: policy:lint, policy:test, policy:simulate
from backend.app.policies.validator import lint_policies


def policy_test(payload: dict) -> dict:
    return {"summary": {"total": 0, "passed": 0, "failed": 0}, "results": []}


def policy_simulate(payload: dict) -> dict:
    import time
    from backend.app.policies.evaluator import evaluate
    from backend.app.policies.repository import fetch_applicable_distilled_prompts
    from backend.app.policies.context_builder import build_policy_context

    stage = payload.get("stage", "pre_query")
    user = payload.get("user", {})
    request_data = payload.get("request", {})
    artifacts = payload.get("artifacts")

    t0 = time.perf_counter()
    decision, changes, trace = evaluate(stage, user, request_data, artifacts=artifacts)
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

    prompts = fetch_applicable_distilled_prompts(stage, user, request_data)
    policy_context = (
        build_policy_context(
            user, prompts,
            role_scope={"role": user.get("role"), "department": user.get("department")},
        )
        if prompts
        else None
    )

    return {
        "decision": decision,
        "data": changes or {},
        "trace": trace,
        "policyContext": policy_context,
        "metrics": {"latencyMs": elapsed_ms},
    }


def policy_lint(payload: dict) -> dict:
    tenant = payload.get("tenant", "acme")
    descriptor_version = payload.get("descriptorVersion", "v0")
    policies = payload.get("policies", [])
    ok, errors, warnings = lint_policies(tenant, descriptor_version, policies)
    return {"ok": ok, "errors": errors, "warnings": warnings}


