from typing import Any, Dict, Optional

import httpx


class GateKeeperClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def enforce(self, stage: str, user: Dict[str, Any], data: Dict[str, Any], artifacts: Optional[Dict[str, Any]] = None, policy_version: Optional[str] = None, correlation_id: Optional[str] = None) -> Dict[str, Any]:
        payload = {
            "stage": stage,
            "user": user,
            "request": data,
            "artifacts": artifacts,
            "policyVersion": policy_version,
            "correlationId": correlation_id,
        }
        resp = httpx.post(f"{self.base_url}/v1/enforce", json=payload, timeout=10.0)
        resp.raise_for_status()
        return resp.json()


