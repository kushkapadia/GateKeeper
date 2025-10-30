from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


Stage = Literal["pre_query", "pre_retrieval", "post_retrieval", "post_generation"]


class EnforcementRequest(BaseModel):
    stage: Stage
    user: Dict[str, Any] = Field(default_factory=dict)
    request: Dict[str, Any] = Field(default_factory=dict)
    artifacts: Optional[Dict[str, Any]] = None
    policyVersion: Optional[str] = None
    correlationId: Optional[str] = None


class TraceItem(BaseModel):
    policy: str
    action: str
    details: Dict[str, Any] = Field(default_factory=dict)


class EnforcementResponse(BaseModel):
    decision: Literal["allowed", "modified", "blocked"]
    data: Dict[str, Any] = Field(default_factory=dict)
    auditId: str
    trace: List[TraceItem] = Field(default_factory=list)
    policyContext: Optional[Dict[str, Any]] = None


