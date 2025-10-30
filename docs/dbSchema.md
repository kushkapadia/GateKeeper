Perfect — let’s continue from there.
Below is a full walkthrough of each table in your GateKeeper schema 👇

---

## 🏢 **1. tenants**

**Purpose:**
Every company or project that installs GateKeeper gets a **tenant record**.
This enables multi-organization use — each with its own policies, schema descriptors, and audit logs.

| Column       | Meaning                                                              |
| ------------ | -------------------------------------------------------------------- |
| `id`         | A short, unique tenant identifier (`acme`, `gov_oman`, `hospital_x`) |
| `name`       | Friendly name of the organization                                    |
| `created_at` | Timestamp of when the tenant was created                             |

✅ **Example**

| id     | name                    | created_at       |
| ------ | ----------------------- | ---------------- |
| `acme` | Acme Healthcare Pvt Ltd | 2025-10-30 10:00 |

👉 So when you load policies or run enforcement, GateKeeper uses `tenant_id` to scope everything cleanly.

---

## 📜 **2. policies**

**Purpose:**
Stores the **policy bundles** themselves — one logical policy (e.g., *“Redact PII”*) belongs to a tenant and can have multiple versions later.

| Column       | Meaning                                                                         |
| ------------ | ------------------------------------------------------------------------------- |
| `id`         | UUID for internal reference                                                     |
| `tenant_id`  | Which tenant owns this policy                                                   |
| `name`       | Policy name (`redact-pii`, `scope-by-department`)                               |
| `labels`     | JSON labels/tags (e.g. `{ "stage": "post_generation", "category": "privacy" }`) |
| `created_by` | Who created it (Studio user email)                                              |
| `created_at` | Timestamp                                                                       |

✅ **Example**

| id        | tenant_id | name         | labels                                                  |
| --------- | --------- | ------------ | ------------------------------------------------------- |
| `a1b2...` | `acme`    | `redact-pii` | `{ "stage": "post_generation", "category": "privacy" }` |

👉 Each “policy” is a **logical rule definition**, but versions are stored separately.

---

## 🔁 **3. policy_versions**

**Purpose:**
Holds the **actual YAML/JSON content** of each policy version.
One policy can have many versions (`v1.0`, `v1.1`, etc.), each describing conditions and actions.

| Column       | Meaning                                                                              |
| ------------ | ------------------------------------------------------------------------------------ |
| `policy_id`  | Links to the base policy                                                             |
| `version`    | Version string (`v1.0`)                                                              |
| `hash`       | SHA256 or similar checksum of content (for idempotence)                              |
| `stage`      | Enforcement hook (`pre_query`, `pre_retrieval`, `post_retrieval`, `post_generation`) |
| `priority`   | Order of evaluation                                                                  |
| `content`    | JSON/YAML object of the actual rule                                                  |
| `enabled`    | Whether active                                                                       |
| `created_at` | Timestamp                                                                            |

✅ **Example (stored content)**

```json
{
  "when": { "any": [ {"user.department": "ICU"} ] },
  "action": { "type": "rewrite", "filters": { "add": {"department": "${user.department}"} } }
}
```

👉 This allows version rollback, testing, and auditability.

---

## 🧩 **4. schema_descriptors**

**Purpose:**
Each organization uploads a **schema.yaml** describing their valid attributes (like `user.role`, `doc.metadata.tags`).
GateKeeper uses this to lint and validate policy fields.

| Column       | Meaning                                   |
| ------------ | ----------------------------------------- |
| `tenant_id`  | Which organization this schema belongs to |
| `version`    | Version of descriptor                     |
| `descriptor` | JSON version of YAML schema               |
| `created_at` | Timestamp                                 |

✅ **Example**

```json
{
  "user_attributes": [
    {"name": "role", "type": "string"},
    {"name": "department", "type": "string"}
  ],
  "doc_metadata": [
    {"name": "sensitivity", "type": "string"}
  ]
}
```

👉 When someone writes a policy using `user.department`, GateKeeper checks this table to ensure it’s valid.

---

## 🧾 **5. audit_index**

**Purpose:**
Lightweight **audit log index** for all policy enforcement decisions — one per request event.
(Full JSON events can later be shipped to S3 or ClickHouse.)

| Column           | Meaning                             |
| ---------------- | ----------------------------------- |
| `audit_id`       | Unique ID of the enforcement event  |
| `tenant_id`      | Tenant for which policy ran         |
| `correlation_id` | Optional trace ID for request chain |
| `ts`             | Timestamp                           |
| `stage`          | Which enforcement stage             |
| `policy_version` | Which version applied               |
| `decision`       | e.g., `allow`, `block`, `redact`    |
| `policies`       | JSON list of applied policies       |
| `metrics`        | JSON counters for aggregation       |

✅ **Example**

| audit_id | tenant_id | stage             | decision | policies              |
| -------- | --------- | ----------------- | -------- | --------------------- |
| `AUD123` | `acme`    | `post_generation` | `redact` | `["redact-pii:v1.2"]` |

👉 This gives you dashboard metrics like “10 blocks this week” or “top policies triggered.”

---

## 👤 **6. studio_users**

**Purpose:**
Users who log into **GateKeeper Studio** (the web dashboard).
Only needed for authentication, roles, and tracking who made changes.

| Column       | Meaning                        |
| ------------ | ------------------------------ |
| `id`         | UUID                           |
| `email`      | Login email                    |
| `role`       | `admin`, `editor`, or `viewer` |
| `created_at` | Timestamp                      |

✅ **Example**

| email             | role     |
| ----------------- | -------- |
| `admin@acme.com`  | `admin`  |
| `intern@acme.com` | `viewer` |

---

## 📊 **7. analytics_snapshots**

**Purpose:**
Pre-computed metrics for dashboards — daily/weekly aggregates instead of querying the raw audit table.

| Column                        | Meaning                                                |
| ----------------------------- | ------------------------------------------------------ |
| `tenant_id`                   | Tenant                                                 |
| `window_start` / `window_end` | Time window                                            |
| `kind`                        | Metric type (`blocks_by_policy`, `violations_by_user`) |
| `payload`                     | JSON blob of stats                                     |

✅ **Example**

```json
{
  "scope-by-department:v1.0": 15,
  "redact-pii:v1.1": 9
}
```

👉 Think of this as “Prometheus-style rollups” stored in SQL for quick display in Studio.

---

## 🧪 **8. policy_test_suites**

**Purpose:**
Holds policy unit tests written via `policy:test`.
These simulate requests to verify that rules behave correctly before deploying.

| Column       | Meaning                                                 |
| ------------ | ------------------------------------------------------- |
| `tenant_id`  | Owner org                                               |
| `name`       | Name of test suite (`test-pii-redaction`)               |
| `content`    | JSON containing test cases (inputs, expected decisions) |
| `created_at` | Timestamp                                               |

✅ **Example**

```json
{
  "tests": [
    {"input": {"user.role": "intern", "query": "show salary"}, "expect": "block"},
    {"input": {"user.role": "admin"}, "expect": "allow"}
  ]
}
```

👉 This lets users verify policies offline (like Jest for policies).

---

## 🧩 Summary Table

| Table                 | Purpose                                |
| --------------------- | -------------------------------------- |
| `tenants`             | Organizations using GateKeeper         |
| `policies`            | Logical policy definitions             |
| `policy_versions`     | Actual rule contents per version       |
| `schema_descriptors`  | Schema for validating field references |
| `audit_index`         | Lightweight enforcement audit metadata |
| `studio_users`        | Auth/roles for GateKeeper Studio       |
| `analytics_snapshots` | Cached aggregates for dashboards       |
| `policy_test_suites`  | Policy behavior tests                  |

---

## 🧠 Why This Design Rocks

* 🔒 **Multi-tenant** from day one
* 🧩 **Versioned policies** with rollback
* 🧾 **Auditable trail** for compliance
* ⚡ **Fast dashboards** via analytics snapshots
* ✅ **Self-testable policies** before production

---

If you want, I can diagrammatically show how these tables connect (ERD — with arrows) and how data flows when a request passes through GateKeeper (from `tenant` → `policy_versions` → `audit_index`).
Would you like me to do that next?
