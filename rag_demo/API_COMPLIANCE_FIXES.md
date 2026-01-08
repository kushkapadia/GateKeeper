# GateKeeper API Compliance Fixes

## Issues Found

I was **NOT** correctly adhering to the GateKeeper API return structure. Here are the fixes:

## API Response Structure

According to `backend/app/models/types.py`, the `EnforcementResponse` is:

```python
class EnforcementResponse(BaseModel):
    decision: Literal["allowed", "modified", "blocked"]
    data: Dict[str, Any]  # This is where changes go
    auditId: str
    trace: List[TraceItem]
    policyContext: Optional[Dict[str, Any]]
```

## Problems Fixed

### 1. **Pre-Query Rewrite** ❌ → ✅

**WRONG (Before):**
```python
modified_query = pre_query_result.get("data", {}).get("query", query)
```

**CORRECT (After):**
```python
# API returns: {"request": {"query": replacement}}
data = pre_query_result.get("data", {})
modified_query = data.get("request", {}).get("query", query)
```

**Why:** `action_rewrite_query()` returns `{"request": {"query": replacement}}`, not `{"query": replacement}`

---

### 2. **Pre-Retrieval Filters** ❌ → ✅

**WRONG (Before):**
```python
filters = pre_retrieval_result.get("data", {}).get("filters", {})
```

**CORRECT (After):**
```python
# API returns: {"request": {"filters": {...}}}
pre_retrieval_data = pre_retrieval_result.get("data", {})
filters = pre_retrieval_data.get("request", {}).get("filters", {})
```

**Why:** `action_add_filters()` returns `{"request": {"filters": new_filters}}`, not `{"filters": new_filters}`

---

### 3. **Post-Retrieval Chunks** ⚠️ → ✅

**ISSUE:** Post-retrieval stage is not fully implemented in GateKeeper backend yet (see INCOMPLETE_FEATURES.md)

**FIXED:** Added flexible handling for multiple possible structures:
```python
# Try different possible structures
sanitized_chunks_data = (
    post_retrieval_data.get("chunks") or 
    post_retrieval_data.get("request", {}).get("chunks") or 
    []
)
```

**Why:** Since post-retrieval isn't implemented, the structure is unknown. This handles both possible formats gracefully.

---

### 4. **Post-Generation Answer** ⚠️ → ✅

**ISSUE:** Post-generation stage is not fully implemented in GateKeeper backend yet

**FIXED:** Added flexible handling:
```python
post_generation_data = post_generation_result.get("data", {})
final_answer = (
    post_generation_data.get("answer") or 
    post_generation_data.get("request", {}).get("answer") or 
    answer
)
```

**Why:** Handles both possible return structures until the backend is fully implemented.

---

## Action Return Structures (from actions.py)

| Action | Returns in `data` field |
|--------|------------------------|
| `action_block(message)` | `{"message": "..."}` |
| `action_rewrite_query(query, replacement)` | `{"request": {"query": replacement}}` |
| `action_add_filters(existing, new_filters)` | `{"request": {"filters": {...}}}` |
| Post-retrieval (not implemented) | Unknown - handled flexibly |
| Post-generation (not implemented) | Unknown - handled flexibly |

## Key Takeaway

**All action handlers wrap their changes in `{"request": {...}}` structure**, except for `action_block` which uses `{"message": "..."}`.

The fixes ensure we correctly extract:
- Modified queries from `data.request.query`
- Filters from `data.request.filters`
- Handle unimplemented stages gracefully

## Testing

To verify the fixes work:

1. **Pre-query rewrite test:**
   - Create a policy that rewrites queries
   - Check that `modified_query` is correctly extracted

2. **Pre-retrieval filters test:**
   - Create a policy that adds filters (e.g., `{"department": "HR"}`)
   - Check that filters are correctly extracted and applied to retrieval

3. **Post-retrieval/post-generation:**
   - These will work once GateKeeper backend implements these stages
   - Current code handles empty/missing data gracefully

