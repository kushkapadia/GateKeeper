from backend.app.models.types import EnforcementRequest


def test_models_import():
    req = EnforcementRequest(stage="pre_query", user={}, request={})
    assert req.stage == "pre_query"


