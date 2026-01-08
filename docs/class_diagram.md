# GateKeeper Class Diagram

This document contains the UML class diagram for the GateKeeper project, following standard UML conventions.

## PlantUML Format

The PlantUML source file is available at `class_diagram.puml` and can be rendered using:
- PlantUML tools (VS Code extension, online editor, etc.)
- IntelliJ IDEA / PyCharm
- Any PlantUML-compatible tool

## Mermaid Format (Rendered Below)

```mermaid
classDiagram
    %% Models Package
    class EnforcementRequest {
        +Stage stage
        +Dict user
        +Dict request
        +Optional[Dict] artifacts
        +Optional[str] policyVersion
        +Optional[str] correlationId
    }
    
    class EnforcementResponse {
        +Literal decision
        +Dict data
        +str auditId
        +List[TraceItem] trace
        +Optional[Dict] policyContext
    }
    
    class TraceItem {
        +str policy
        +str action
        +Dict details
    }
    
    class Stage {
        <<enumeration>>
        pre_query
        pre_retrieval
        post_retrieval
        post_generation
    }
    
    %% Core Package
    class Settings {
        +str app_name
        +str environment
        +str redis_url
        +str database_url
        +str policy_version
    }
    
    class RedisClient {
        -ConnectionPool _pool
        +get_redis() Redis
    }
    
    %% Auth Package
    class AuthModule {
        +hash_password(str) str
        +verify_password(str, str) bool
        +create_jwt_token(str, str) str
        +verify_jwt_token(str) Optional[dict]
        +authenticate_tenant(str, str) Optional[dict]
    }
    
    %% Policies Package
    class PolicyEvaluator {
        +evaluate(str, Dict, Dict) Tuple
        -_render(Any, Dict) Any
    }
    
    class PolicyRepository {
        +fetch_policies_for_stage(str, str) List[Tuple]
        +fetch_applicable_distilled_prompts(str, Dict, Dict) List[str]
        -_eval_when_ctx(Dict, str) bool
    }
    
    class PolicyDescriptor {
        +save_descriptor(str, str, str) bool
        +fetch_descriptor(str, str) Dict
        +fetch_descriptor_paths(str, str) Dict
    }
    
    class PolicyValidator {
        +lint_policies(str, str, List) Tuple
        +extract_paths(Dict) List[str]
    }
    
    class PolicyContextBuilder {
        +build_policy_context(Dict, List, Optional[Dict]) Dict
    }
    
    class PolicyActions {
        +action_block(str) Tuple
        +action_rewrite_query(str, str) Tuple
        +action_add_filters(Dict, Dict) Tuple
    }
    
    class PathResolver {
        +get_by_path(Dict, str) Any
        +eval_expr(Dict, str) bool
    }
    
    %% Audit Package
    class AuditLogger {
        +configure_logging() None
        +get_logger() Logger
    }
    
    %% Main Application
    class FastAPIApplication {
        +FastAPI app
        +enforce(EnforcementRequest) EnforcementResponse
        +login(dict) dict
        +lint_policy_endpoint(dict) dict
        +simulate_policy_endpoint(dict) dict
        +test_policy_endpoint(dict) dict
        +get_current_tenant(str) dict
    }
    
    %% MCP Server
    class MCPServer {
        +policy_test(dict) dict
        +policy_simulate(dict) dict
        +policy_lint(dict) dict
    }
    
    %% RAG Demo Package
    class RAGEngine {
        -SentenceTransformer embedding_model
        -Dict documents
        -List all_chunks
        -ndarray all_embeddings
        -Dict chunk_to_doc
        -Dict chunk_metadata
        +add_document(str, str) str
        +retrieve(str, int, Optional[Dict]) List[Dict]
        +list_documents() List[Dict]
        +remove_document(str) bool
        -_extract_text(str) str
        -_chunk_text(str, int, int) List[str]
        -_extract_metadata_from_filename(str) Dict
        -_rebuild_index() None
        -_matches_filters(int, Dict) bool
    }
    
    class NormalModeRules {
        -List blocked_terms
        -Dict role_restrictions
        -GenerativeModel model
        +process_query(str, Dict, RAGEngine) Dict
        -_pre_query_check(str, Dict) Tuple
        -_pre_retrieval_filters(str, Dict) Dict
        -_post_retrieval_sanitize(List, Dict) List
        -_post_generation_validate(str, Dict) str
    }
    
    class GatekeeperMode {
        -GateKeeperClient gatekeeper
        -str gatekeeper_url
        -GenerativeModel model
        +process_query(str, Dict, RAGEngine) Dict
        -_enforce_async(str, Dict, Dict) Dict
    }
    
    %% SDK
    class GateKeeperClient {
        +enforce(str, Dict, Dict) Dict
    }
    
    %% Relationships
    FastAPIApplication --> EnforcementRequest : uses
    FastAPIApplication --> EnforcementResponse : returns
    FastAPIApplication --> PolicyEvaluator : uses
    FastAPIApplication --> PolicyRepository : uses
    FastAPIApplication --> PolicyValidator : uses
    FastAPIApplication --> PolicyDescriptor : uses
    FastAPIApplication --> AuthModule : uses
    FastAPIApplication --> Settings : uses
    
    PolicyEvaluator --> PolicyRepository : uses
    PolicyEvaluator --> PolicyActions : uses
    PolicyEvaluator --> PathResolver : uses
    PolicyEvaluator --> Settings : uses
    
    PolicyRepository --> PathResolver : uses
    PolicyRepository --> Settings : uses
    
    PolicyValidator --> PolicyDescriptor : uses
    
    PolicyContextBuilder --> PolicyRepository : uses
    
    MCPServer --> PolicyValidator : uses
    
    EnforcementResponse --> TraceItem : contains
    EnforcementRequest --> Stage : uses
    
    RedisClient --> Settings : uses
    AuthModule --> Settings : uses
    
    NormalModeRules --> RAGEngine : uses
    GatekeeperMode --> RAGEngine : uses
    GatekeeperMode --> GateKeeperClient : uses
    GateKeeperClient ..> FastAPIApplication : HTTP calls
```

## Diagram Legend

### Visibility Modifiers
- `+` = Public
- `-` = Private
- `#` = Protected

### Package Organization
The diagram is organized into logical packages:
1. **backend.app.models** - Data models (Pydantic BaseModel classes)
2. **backend.app.core** - Core configuration and infrastructure
3. **backend.app.auth** - Authentication and authorization
4. **backend.app.policies** - Policy evaluation and management
5. **backend.app.audit** - Audit logging
6. **backend.app** - Main FastAPI application
7. **mcp.server** - MCP server for policy tools
8. **rag_demo.backend** - Demo RAG engine components
9. **sdk.python.gatekeeper_sdk** - Python SDK client

### Key Relationships

1. **FastAPIApplication** is the main entry point that orchestrates:
   - Policy evaluation through `PolicyEvaluator`
   - Policy retrieval through `PolicyRepository`
   - Policy validation through `PolicyValidator`
   - Authentication through `AuthModule`

2. **PolicyEvaluator** coordinates policy evaluation by:
   - Fetching policies via `PolicyRepository`
   - Executing actions via `PolicyActions`
   - Resolving paths via `PathResolver`

3. **PolicyValidator** ensures policy correctness by:
   - Validating against schema descriptors via `PolicyDescriptor`

4. **RAG Demo Components** demonstrate integration:
   - `NormalModeRules` uses hardcoded rules
   - `GatekeeperMode` integrates with the GateKeeper API via `GateKeeperClient`

### Design Patterns

- **Repository Pattern**: `PolicyRepository` abstracts database access
- **Strategy Pattern**: Different policy actions (`PolicyActions`) can be applied
- **Factory Pattern**: `PolicyContextBuilder` creates policy contexts
- **Dependency Injection**: Settings and configuration are injected via `Settings` class

