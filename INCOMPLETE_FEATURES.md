# Incomplete Features & Planned Work

## 🔴 **INCOMPLETE FUNCTIONALITIES (Stubs/Placeholders)**

### 1. **Audit & Logging System**
- **Status**: Stub only
- **Location**: `backend/app/main.py:68` - `auditId="audit-stub"`
- **What's Missing**:
  - Real audit ID generation
  - Writing audit events to `audit_index` table
  - Structured logging with full trace details
  - User ID pseudonymization (hashing)
  - Correlation ID tracking
- **Database**: Table exists (`audit_index`) but not being populated

### 2. **Analytics & Metrics**
- **Status**: Stub endpoints, no data
- **Locations**:
  - `backend/app/main.py:102-105` - `/api/analytics/risky-users` returns empty array
  - `studio/app/analytics/page.tsx:23` - Frontend shows placeholder
- **What's Missing**:
  - Prometheus metrics (counters, histograms)
  - Redis-based risky user tracking
  - Policy trigger frequency analytics
  - Latency metrics per stage
  - PII redaction counts
  - Citation compliance tracking
  - Grafana dashboard integration

### 3. **Policy Management API**
- **Status**: Stub endpoint
- **Location**: `backend/app/main.py:96-99` - `/api/policies` returns empty array
- **What's Missing**:
  - Fetch policies from database
  - CRUD operations (create, update, delete)
  - Policy version management
  - Policy rollback functionality

### 4. **Studio - Policy Saving**
- **Status**: Alert placeholder
- **Location**: `studio/app/policies/page.tsx:376-377`
- **What's Missing**:
  - API endpoint to save policies
  - Policy validation before save
  - Version creation
  - Conflict resolution

### 5. **Studio - Simulator Integration**
- **Status**: TODO comment
- **Location**: `studio/app/simulator/page.tsx:21`
- **What's Missing**:
  - Call to `/api/policies/simulate` endpoint
  - Real-time simulation results display
  - Multiple role testing

### 6. **MCP Server - Policy Testing**
- **Status**: Returns empty results
- **Location**: `mcp/server/main.py:5-6`
- **What's Missing**:
  - Actual test case execution
  - Golden test case support
  - Test result validation
  - Test report generation

### 7. **MCP Server - Policy Simulation**
- **Status**: Returns stub data
- **Location**: `mcp/server/main.py:9-10`
- **What's Missing**:
  - Real policy evaluation
  - Metrics calculation (latency)
  - Full trace generation
  - Decision logic

### 8. **Post-Generation - Confidence Gating**
- **Status**: Placeholder comment
- **Location**: `backend/app/policies/actions.py:89-94`
- **What's Missing**:
  - Integration with LLM metadata
  - Confidence threshold checking
  - Violation reporting

### 9. **Redis Caching**
- **Status**: Client exists, not used
- **Location**: `backend/app/core/redis_client.py` - Connection pool exists
- **What's Missing**:
  - Policy context caching (`policy:{version}`)
  - User attributes caching (`user:attrs:{id}`)
  - Schema descriptor caching (`schema:{tenant}`)
  - Rate limiting implementation
  - Idempotency keys
  - TTL management

### 10. **Rate Limiting**
- **Status**: Not implemented
- **What's Missing**:
  - Token bucket algorithm
  - Per-tenant/user/stage limits
  - Redis-based counters
  - Quota enforcement

### 11. **Idempotency**
- **Status**: Not implemented
- **What's Missing**:
  - Correlation ID tracking
  - Duplicate request detection
  - Short TTL key management

---

## 🟡 **PLANNED FEATURES (Not Started)**

### 1. **Natural Language → Policy Compiler**
- **Status**: Stretch goal, not started
- **Planned Location**: New service/endpoint
- **What's Needed**:
  - LLM integration for NL parsing
  - Policy draft generation
  - Human approval workflow
  - Studio UI for NL input

### 2. **Advanced Post-Retrieval Features**
- **Status**: Partially implemented (only basic email redaction)
- **What's Missing**:
  - Summary degradation (downgrade restricted content to summaries)
  - Source validation (drop invalid/outdated docs)
  - Advanced chunk filtering by sensitivity levels
  - Content-based redaction (not just PII patterns)

### 3. **Advanced Post-Generation Features**
- **Status**: Basic citation check only
- **What's Missing**:
  - Output redaction (detect leaked PII in generated text)
  - Fallback responses ("This information is restricted")
  - Tone/style control (formal, neutral, etc.)
  - Full confidence gating with LLM metadata

### 4. **Pre-Query Advanced Features**
- **Status**: Basic blocking and query matching implemented
- **What's Missing**:
  - Query rewriting (convert queries)
  - Rate limiting per role/time window
  - Intent detection using LLM classification
  - Suggested phrasing for blocked queries

### 5. **Pre-Retrieval Advanced Features**
- **Status**: Basic filter addition implemented
- **What's Missing**:
  - Break-glass override (temporary elevated access with TTL)
  - Query shaping (similarity threshold, top-k adjustment)
  - Time/region/device-based conditions
  - KB-specific access restrictions

### 6. **MCP Server Phase 2 Tools**
- **Status**: Phase 1 tools (lint, test, simulate) partially done
- **What's Missing**:
  - `audit:get` - Retrieve specific audit entry
  - `audit:search` - Search audit logs
  - `metrics:snapshot` - Get current metrics
  - `policy:propose_from_nl` - NL to policy conversion

### 7. **GitOps Integration**
- **Status**: Not started
- **What's Needed**:
  - CI pipeline integration
  - GitHub Actions workflow
  - Policy linting in PRs
  - Policy testing in PRs
  - Automated deployment

### 8. **Kubernetes Webhook (Admission Control)**
- **Status**: Not started
- **What's Needed**:
  - Webhook server
  - Policy validation for deployments
  - Rejection of unsafe deploys

### 9. **SDK Adapters**
- **Status**: Basic Python SDK exists
- **What's Missing**:
  - LangChain adapter
  - LlamaIndex adapter
  - Haystack connector

### 10. **Compliance Reporting**
- **Status**: Not started
- **What's Needed**:
  - Monthly audit exports
  - Policy usage reports
  - Rule trigger analytics
  - Export formats (CSV, JSON, PDF)

### 11. **Policy Signing**
- **Status**: Not started
- **What's Needed**:
  - Tamper-proof policy bundles
  - Signature verification
  - Cryptographic signing

### 12. **PII/NER Helper Service**
- **Status**: Optional component, not started
- **What's Needed**:
  - Lightweight microservice
  - NER-based masking
  - LLM-assisted detection
  - Async processing support

### 13. **Ontology/Tag Mapper**
- **Status**: Not started
- **What's Needed**:
  - Document tag to access level mapping
  - Hierarchical tag system
  - Access level inheritance

### 14. **Policy Evaluator CLI**
- **Status**: Not started
- **What's Needed**:
  - Local testing tool
  - Debug mode
  - Policy validation CLI
  - Test case runner

### 15. **Grafana Dashboards**
- **Status**: Not started
- **What's Needed**:
  - Dashboard configuration
  - Metrics visualization
  - Real-time monitoring
  - Alert rules

### 16. **User Pseudonymization**
- **Status**: Not implemented
- **What's Needed**:
  - Tenant-salted hashing
  - User ID hashing in audit logs
  - Privacy-preserving analytics

### 17. **Services Directory**
- **Status**: Empty directory exists
- **Location**: `backend/app/services/`
- **Potential Services**:
  - Audit service
  - Metrics service
  - Cache service
  - Rate limiting service

---

## 📋 **PRIORITY RECOMMENDATIONS**

### **High Priority (Core Functionality)**
1. ✅ Audit logging system (critical for compliance)
2. ✅ Policy management API (needed for Studio)
3. ✅ Redis caching (performance)
4. ✅ Real audit ID generation
5. ✅ Studio policy saving

### **Medium Priority (Enhanced Features)**
1. Analytics & metrics
2. Rate limiting
3. Post-generation confidence gating
4. MCP server test/simulate implementation
5. Advanced redaction features

### **Low Priority (Nice to Have)**
1. NL → Policy compiler
2. GitOps integration
3. SDK adapters
4. Grafana dashboards
5. Compliance reporting

---

## 🔍 **NOTES**

- **Major Open Question** (from README line 69-70):
  > "If gatekeeper correctly handles the request in pre query mode, even then the rules will be passed to the llm (which will contradict) but when it falsely passes the system, then it shouldn't. how do we handle this?"
  
  This needs architectural decision on when to pass policyContext vs when to block.

- **Database**: All tables exist and migrations are in place
- **Basic Enforcement**: Core policy evaluation works for all 4 stages
- **Redaction**: Basic email redaction implemented, other PII patterns exist but need policy configuration

