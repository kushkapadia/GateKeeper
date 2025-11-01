# One-Time Action Handlers vs Automatic Processing

## ✅ YES - You've Got It Exactly Right!

**One-Time Implementation:**
- Implement each ACTION TYPE handler once (block, rewrite, filter, redact, etc.)
- These handlers work with **any** policy and **any** dynamic data

**Automatic Processing:**
- Condition evaluation → **Automatic** (generic path resolver)
- Field access (`user.role`, `user.department`, etc.) → **Automatic** (dynamic)
- Policy loading from DB → **Automatic**
- Template rendering (`${user.department}`) → **Automatic** (generic)
- Matching against ANY field → **Automatic**

---

## 🏗️ How It Works (Visual Flow)

### Example: Policy in Database
```yaml
name: block-intern-salary
stage: pre_query
when:
  all:
    - expr: user.role == "intern"        # ← Dynamic field access
match:
  query.text: ["salary", "compensation"]  # ← Dynamic matching
action:
  type: block                             # ← Calls ONE-TIME handler
  message: "Access denied"
```

### Runtime Flow:

```
1. Request comes in:
   {
     "user": {"role": "intern", "department": "HR"},  ← Dynamic data
     "request": {"query": {"text": "What is the salary?"}}
   }
        ↓
2. Evaluator reads ALL policies from DB (automatic)
        ↓
3. For each policy:
   a. Evaluate conditions (automatic):
      - Path resolver: get_by_path(ctx, "user.role") → "intern" ✅
      - Expression evaluator: "intern" == "intern" → True ✅
        ↓
   b. Check match (automatic):
      - Extract query.text: "What is the salary?"
      - Check against ["salary", "compensation"] → Match! ✅
        ↓
   c. Execute action (ONE-TIME handler):
      - Calls: action_block("Access denied")
      - Returns: {"decision": "blocked", "message": "Access denied"}
        ↓
4. Return response (automatic)
```

**Key Point:** The handler (`action_block`) was written ONCE, but it processes ANY policy with ANY data automatically.

---

## 📋 One-Time Handlers Needed

### ✅ Already Implemented (Work for ALL policies)
1. **`action_block(message)`** - ONE implementation handles ALL block policies
2. **`action_add_filters(existing, new_filters)`** - ONE implementation handles ALL rewrite policies
3. **`action_rewrite_query(query, replacement)`** - ONE implementation handles ALL query rewrites

### 🔨 Need to Implement (ONE each, work for ALL policies)
4. **`action_filter_chunks(chunks, keep_if, drop_if)`** - ONE implementation handles ALL filter policies
5. **`action_redact(text, patterns, fields)`** - ONE implementation handles ALL redaction policies
6. **`action_enforce_citations(answer, min_count)`** - ONE implementation handles ALL citation policies
7. **`action_rate_limit(user_id, limit, window)`** - ONE implementation handles ALL rate limiting policies

---

## 🎯 Real Example: How One Handler Processes 1000 Policies

### Scenario: 1000 different block policies

**Policy 1:**
```yaml
when:
  - expr: user.role == "intern"
action:
  type: block
  message: "Interns not allowed"
```
→ Calls `action_block("Interns not allowed")` ✅

**Policy 2:**
```yaml
when:
  - expr: user.department == "Finance"
  - expr: user.clearance < 3
action:
  type: block
  message: "Insufficient clearance"
```
→ Calls `action_block("Insufficient clearance")` ✅ (SAME handler!)

**Policy 3:**
```yaml
when:
  - expr: user.risk_score > 8
action:
  type: block
  message: "High risk detected"
```
→ Calls `action_block("High risk detected")` ✅ (SAME handler!)

**...Policy 1000:**
```yaml
when:
  - expr: user.tenant_id != "premium"
  - expr: request.query.text.contains("premium feature")
action:
  type: block
  message: "Premium feature required"
```
→ Calls `action_block("Premium feature required")` ✅ (SAME handler!)

**Result:** ONE `action_block()` function handles ALL 1000 policies!

---

## 🔄 What Happens Automatically (No Code Needed)

### 1. **Condition Evaluation** - 100% Automatic
```python
# Policy says: user.role == "intern"
# Runtime data: {"user": {"role": "intern"}}

# Generic resolver automatically:
get_by_path(ctx, "user.role")  # → "intern" (automatic!)
eval_expr(ctx, "user.role == 'intern'")  # → True (automatic!)

# Works for ANY field, ANY operator, ANY data structure!
```

**You never write code for specific fields.** The resolver handles:
- `user.role` ✅
- `user.department` ✅
- `user.clearance` ✅
- `chunk.metadata.tags` ✅
- `request.top_k` ✅
- **ANY field from descriptor** ✅

### 2. **Template Rendering** - 100% Automatic
```python
# Policy says: department: "${user.department}"
# Runtime data: {"user": {"department": "HR"}}

# Generic renderer automatically:
_render("${user.department}", ctx)  # → "HR" (automatic!)

# Works for ANY field substitution!
```

### 3. **Matching** - 100% Automatic
```python
# Policy says: query.text: ["salary", "compensation"]
# Runtime data: {"request": {"query": {"text": "What is the salary?"}}}

# Generic matcher automatically checks:
query_text = get_by_path(ctx, "request.query.text")  # → "What is the salary?"
"salary" in query_text.lower()  # → True (automatic!)

# Works for ANY field, ANY match type!
```

### 4. **Policy Loading** - 100% Automatic
```python
# Evaluator automatically:
policies = fetch_policies_for_stage(stage, version)  # Gets ALL policies from DB

# Loops through ALL policies automatically:
for policy in policies:
    # Evaluate conditions (automatic)
    # Execute actions (using ONE-TIME handlers)
```

---

## 📊 Summary Table

| Component | Implementation | Works For |
|-----------|---------------|-----------|
| **Condition Evaluation** | ✅ Generic resolver (done) | ALL fields, ALL operators, ALL data |
| **Template Rendering** | ✅ Generic renderer (done) | ALL template substitutions |
| **Policy Loading** | ✅ Generic DB fetcher (done) | ALL policies, ALL stages |
| **Block Handler** | ✅ ONE implementation (done) | ALL block policies |
| **Rewrite Handler** | ✅ ONE implementation (done) | ALL rewrite policies |
| **Filter Handler** | 🔨 ONE implementation (needed) | ALL filter policies |
| **Redact Handler** | 🔨 ONE implementation (needed) | ALL redaction policies |
| **Enforce Handler** | 🔨 ONE implementation (needed) | ALL enforcement policies |

**Total:** ~7 handlers (most already done!)
**Capacity:** Unlimited policies (2000, 10000, 100000+)

---

## ✅ Your Understanding is 100% Correct!

**What you said:**
> "We just need to add one-time logics for filtering, rewrite, redaction, allow, disallow, etc. Rest all will happen automatically on dynamic data that we get as input automatically right?"

**Answer: YES! Exactly!** ✅

1. **One-time handlers:** ✅ Block, rewrite, filter, redact (once each)
2. **Automatic processing:** ✅ Condition evaluation, field access, matching, template rendering
3. **Dynamic data:** ✅ Works with ANY user data, ANY request structure
4. **Unlimited policies:** ✅ Add 2000+ policies via YAML, all work automatically

**Architecture is:**
- **Handlers:** ONE per action type (reusable)
- **Engine:** Generic (processes any policy)
- **Data:** Dynamic (works with any input)
- **Policies:** Unlimited (stored in DB)

You've understood the architecture perfectly! 🎯

