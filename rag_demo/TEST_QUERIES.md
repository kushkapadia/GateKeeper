# Test Queries for RAG Demo

## Document Upload Order
1. Upload `demo_document_hr.txt` first
2. Upload `demo_document_it.txt` second

## Test Scenarios

### Scenario 1: Pre-Query Blocking (Normal Mode)
**Setup:**
- Mode: Normal
- User Role: `intern`
- Department: `HR`

**Query:** "What are the salary ranges for different positions?"

**Expected Result:**
- ✅ Query should be BLOCKED at pre-query stage
- Reason: Contains restricted term "salary" for intern role
- No answer generated

**Why this shows Gatekeeper is better:**
- Gatekeeper can have more sophisticated blocking rules
- Can show policy trace and audit trail

---

### Scenario 2: Pre-Retrieval Filtering
**Setup:**
- Mode: Normal
- User Role: `intern`
- Department: `IT`

**Query:** "What are the company's security policies?"

**Expected Result:**
- ✅ Query allowed
- ✅ Pre-retrieval stage applies department filter
- Should only retrieve IT-related documents
- HR document should be filtered out

**Why this shows Gatekeeper is better:**
- Gatekeeper policies can be more dynamic
- Can show which policies triggered

---

### Scenario 3: Post-Retrieval Redaction (Normal Mode)
**Setup:**
- Mode: Normal
- User Role: `user` (not admin)
- Department: `HR`

**Query:** "What are the contact emails for HR department?"

**Expected Result:**
- ✅ Query allowed
- ✅ Documents retrieved
- ✅ Post-retrieval: Email addresses REDACTED
- Answer should show `[EMAIL REDACTED]` instead of actual emails

**Why this shows Gatekeeper is better:**
- Gatekeeper can have more sophisticated PII detection
- Can redact multiple types of sensitive data
- Better audit trail

---

### Scenario 4: Post-Generation Validation
**Setup:**
- Mode: Normal
- User Role: `intern`
- Department: `HR`

**Query:** "Tell me about employee compensation"

**Expected Result:**
- ✅ Query might pass (doesn't contain exact blocked term)
- ✅ Documents retrieved (may contain salary info)
- ✅ Post-retrieval: Some chunks filtered
- ✅ Post-generation: Answer validated and modified if contains compensation info
- Final answer should be sanitized

**Why this shows Gatekeeper is better:**
- Gatekeeper can detect leaked sensitive info in generated text
- More sophisticated content validation

---

### Scenario 5: Gatekeeper Mode - Full Policy Enforcement
**Setup:**
- Mode: **Gatekeeper**
- User Role: `guest`
- Department: `general`

**Query:** "Show me confidential information about salaries"

**Expected Result:**
- ✅ Pre-query: May block or rewrite query
- ✅ Pre-retrieval: Apply strict filters
- ✅ Post-retrieval: Aggressive redaction
- ✅ Post-generation: Final validation
- All 4 stages show policy trace
- Complete audit trail visible

**Why this demonstrates value:**
- Shows all 4 enforcement stages
- Policy trace shows which rules triggered
- Complete observability

---

### Scenario 6: Admin Access (Both Modes)
**Setup:**
- Mode: Both (test separately)
- User Role: `admin`
- Department: `HR`

**Query:** "What are the salary ranges and HR contact emails?"

**Expected Result:**
- ✅ Normal Mode: May show some info (admin bypasses some rules)
- ✅ Gatekeeper Mode: Shows full info with policy context
- Both should work, but Gatekeeper shows policy decisions

**Why this shows Gatekeeper is better:**
- Clear policy visibility
- Shows why admin has access
- Better for compliance audits

---

### Scenario 7: Complex Query - Gatekeeper Advantage
**Setup:**
- Mode: **Gatekeeper**
- User Role: `intern`
- Department: `IT`

**Query:** "I need to know about network configurations and employee salaries"

**Expected Result:**
- ✅ Pre-query: May block or rewrite (contains "salaries")
- If allowed, pre-retrieval filters to IT department only
- Post-retrieval removes salary-related chunks
- Post-generation validates answer doesn't leak salary info
- Shows sophisticated multi-stage enforcement

**Why this demonstrates superiority:**
- Multi-stage protection
- Context-aware filtering
- Comprehensive security

---

## Quick Demo Flow for Ma'am

### Part 1: Show Normal Mode Limitations
1. Upload both documents
2. Set role: `intern`, dept: `HR`
3. Query: "What are the salary ranges?"
4. Show: Blocked at pre-query (hardcoded rule)
5. **Point:** Limited, hardcoded rules

### Part 2: Show Gatekeeper Mode Advantages
1. Switch to Gatekeeper mode
2. Same role: `intern`, dept: `HR`
3. Same query: "What are the salary ranges?"
4. Show: 
   - Policy trace at each stage
   - More sophisticated blocking
   - Audit trail
   - Policy context
5. **Point:** Flexible, auditable, policy-driven

### Part 3: Show Accuracy Difference
1. Gatekeeper mode
2. Role: `user`, dept: `IT`
3. Query: "What are the HR contact emails?"
4. Show:
   - Better PII redaction
   - More accurate filtering
   - Policy trace shows why
5. **Point:** More accurate enforcement

### Part 4: Show Speed (if optimized)
1. Run same query in both modes
2. Show timing (if you add timing)
3. **Point:** Async calls make Gatekeeper competitive

---

## Key Talking Points

1. **Normal Mode:**
   - Fast (no API calls)
   - Hardcoded rules
   - Limited flexibility
   - No audit trail

2. **Gatekeeper Mode:**
   - Slightly slower (4 API calls) but optimized with async
   - Policy-driven (flexible, updatable)
   - Complete audit trail
   - Better accuracy (sophisticated rules)
   - Observable (policy trace)
   - Production-ready

3. **For Evaluation:**
   - Emphasize: **Accuracy > Speed** for security
   - Show: Policy trace and audit trail
   - Demonstrate: Multi-stage protection
   - Highlight: Enterprise-ready governance

