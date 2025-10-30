## GateKeeper Diagrams

### 1) High-level Architecture (Components)
```mermaid
flowchart LR
  U[User] -->|Query| APP[RAG App]
  subgraph GK[GateKeeper]
    PE[Enforcement API]
    PR[Policy Registry]
    RE[Redis Cache / Rate Limit]
    OBS[Metrics + Audit Logs]
  end

  APP -->|pre_query| PE
  APP -->|pre_retrieval| PE
  APP -->|post_retrieval| PE
  APP -->|post_generation| PE

  PE --> PR
  PE <---> RE
  PE --> OBS

  APP -->|Retrieval| VDB[(Vector DB - external)]
  APP -->|LLM call| LLM[(LLM Provider - external)]

  subgraph Studio[Rules Studio]
    UI[Policy Authoring + Simulation]
    MCP[MCP Tools]
  end
  UI --> MCP
  MCP --> PR
  MCP --> OBS
```

### 2) Enforcement Stages (Sequence per Request)
```mermaid
sequenceDiagram
  participant U as User
  participant A as RAG App
  participant G as GateKeeper
  participant V as Vector DB (external)
  participant L as LLM (external)

  U->>A: Ask question
  A->>G: enforce(pre_query, user, request)
  G-->>A: decision/block or rewritten query

  A->>G: enforce(pre_retrieval, user, request)
  G-->>A: filters/params (scoped)
  A->>V: retrieve with filters
  V-->>A: chunks

  A->>G: enforce(post_retrieval, user, {chunks})
  G-->>A: sanitized chunks
  A->>L: generate answer with sanitized context
  L-->>A: draft answer

  A->>G: enforce(post_generation, user, {answer})
  G-->>A: final answer or fallback
  Note over G: Audit event + metrics at every stage
  A-->>U: Safe, compliant response
```

### 3) Context Awareness (Schema + Runtime)
```mermaid
flowchart TB
  SD[schema.yaml (descriptor)] -->|valid fields| LINT[policy:lint]
  SD -->|drives| UI[Studio Autocomplete]
  subgraph Runtime
    UC[user_ctx]
    RC[request_ctx]
    DC[doc.metadata]
  end
  A2[Policies (YAML/JSON)] --> LINT
  LINT --> PR[Policy Registry]
  UC --> ENF[GateKeeper Enforcement]
  RC --> ENF
  DC --> ENF
  PR --> ENF
  ENF --> OBS[Audit + Metrics]
```

### 4) Risky Users Analytics (Top-N)
```mermaid
flowchart LR
  ENF[Enforcement] --> Evt[Audit Event]
  ENF --> RC[Redis Counters (blocks, attacks)]
  Evt --> IDX[Audit Index (Postgres)]
  RC --> API[/Analytics API/]
  IDX --> API
  API --> UI[Studio Dashboard]
```


