# AI-Native Headless CRM v0 Spec (Local-Only)

**Status**
Draft v0 for agent-first local runtime.

**Goals**
1. Agent-first data model that is easy to read, write, and explain.
2. Deterministic retrieval for exact facts and relationships.
3. Full auditability via append-only event ledger.
4. Field-level provenance and confidence to support agent reasoning.
5. Local-only runtime with minimal dependencies.

**Non-Goals (v0)**
1. Vector search or embedding pipelines.
2. Multi-tenant isolation and hosted sync.
3. External connectors or enrichment pipelines.
4. Human UI.

**Core Concepts**
1. Entity: a typed record with JSON properties and a short summary.
2. Relationship: a typed edge between two entities.
3. Event: immutable log entry for every mutation.
4. Provenance: source metadata for fields and relationships.

---

## Data Contract

**Entity (base fields)**
1. `id` string (ULID or UUID).
2. `type` enum: `contact`, `company`, `deal`, `interaction`, `task`, `agent`.
3. `properties` JSON object (type-specific fields).
4. `schema_version` string.
5. `created_at` timestamp (ISO-8601).
6. `updated_at` timestamp (ISO-8601).
7. `status` enum: `active`, `archived`.
8. `summary` string (short agent-written text).
9. `confidence` number (0.0 to 1.0).
10. `verification` enum: `unverified`, `verified`, `low_confidence`.
11. `provenance` JSON object (global default provenance for this entity).

**Contact (properties)**
1. `full_name` string.
2. `email` string.
3. `phone` string.
4. `title` string.
5. `location` string.
6. `linkedin_url` string.
7. `notes` string.

**Company (properties)**
1. `name` string.
2. `domain` string.
3. `industry` string.
4. `size` string.
5. `location` string.
6. `notes` string.

**Deal (properties)**
1. `name` string.
2. `value` number.
3. `currency` string.
4. `stage` string.
5. `close_date` date (ISO-8601).
6. `notes` string.

**Interaction (properties)**
1. `type` enum: `email`, `call`, `meeting`, `note`.
2. `timestamp` timestamp (ISO-8601).
3. `participants` array of entity ids.
4. `content` string.
5. `outcome` string.

**Task (properties)**
1. `title` string.
2. `status` enum: `todo`, `doing`, `done`.
3. `priority` enum: `low`, `medium`, `high`.
4. `due_date` date (ISO-8601).
5. `assignee` entity id.
6. `notes` string.

**Agent (properties)**
1. `name` string.
2. `agent_type` enum: `system`, `human`, `model`.
3. `capabilities` array of strings.
4. `trust_tier` enum: `low`, `medium`, `high`.
5. `notes` string.

**Schema Versioning**
1. Each entity stores `schema_version`.
2. v0 changes must be backward compatible where possible.

---

## Relationships

**Relationship Fields**
1. `id` string.
2. `from_id` entity id.
3. `to_id` entity id.
4. `type` enum.
5. `metadata` JSON object.
6. `confidence` number (0.0 to 1.0).
7. `verification` enum: `unverified`, `verified`, `low_confidence`.
8. `created_at` timestamp (ISO-8601).

**Relationship Types (v0)**
1. `EMPLOYED_AT` contact → company.
2. `ASSOCIATED_WITH` contact → deal.
3. `OWNS` company → deal.
4. `INTERACTED_WITH` interaction → contact or company or deal.
5. `CREATED_BY` entity → agent.
6. `RELATED_TO` entity ↔ entity.

---

## Event Ledger

**Event Fields**
1. `event_id` string.
2. `entity_id` string.
3. `event_type` enum: `create`, `update`, `delete`, `merge`.
4. `diff` JSON Patch array or change object.
5. `actor` agent id.
6. `prompt_hash` string.
7. `tool_call_id` string.
8. `timestamp` timestamp (ISO-8601).

**Rules**
1. Append-only, never updated.
2. Every mutation creates exactly one event.
3. Deletions are soft by default via entity `status`.

---

## Provenance

**Provenance Object**
1. `source_agent` agent id.
2. `tool_call_id` string.
3. `prompt_hash` string.
4. `timestamp` timestamp (ISO-8601).
5. `confidence` number (0.0 to 1.0).
6. `verification` enum: `unverified`, `verified`, `low_confidence`.

**Notes**
1. Each field can optionally store its own provenance.
2. If a field-level provenance is missing, fall back to entity provenance.

---

## Retrieval Surfaces

**Structured Search**
1. Filter by field values (exact, range, enum).
2. Sort by fields with pagination.
3. Optional time-range filter using `created_at` and `updated_at`.

**Graph Traversal**
1. Traverse inbound or outbound relationships.
2. Filter by relationship type.
3. Hop depth limit per query.

**FTS (SQLite FTS5)**
1. Index fields: name, email, title, notes, summary, interaction content.
2. Keyword search with basic ranking.

---

## Idempotency and Conflict Rules

**Idempotency**
1. Every write endpoint accepts `idempotency_key`.
2. Same key and payload must return the same result without duplication.

**Conflict Rules (v0)**
1. Default: last write wins.
2. Optional field-level lock to prevent overwrites.
3. Optional source priority list for critical fields like email and domain.

---

## API Contract (High-Level)

**REST Endpoints**
1. `POST /entities`
2. `GET /entities/:id`
3. `PATCH /entities/:id`
4. `DELETE /entities/:id`
5. `POST /relationships`
6. `DELETE /relationships/:id`
7. `GET /search`
8. `GET /graph`
9. `GET /events`

**MCP Tools (v0)**
1. `create_entity`
2. `update_entity`
3. `get_entity`
4. `search_entities`
5. `link_entities`
6. `unlink_entities`
7. `traverse_graph`
8. `get_entity_history`

---

## Storage Layout (SQLite)

**Tables**
1. `entities` for core entity records and JSON properties.
2. `relationships` for edges.
3. `events` for the append-only ledger.
4. `field_provenance` for per-field overrides.
5. `entity_fts` as FTS5 virtual table.

---

## Export and Import

**Export**
1. JSON export of entities, relationships, and events.
2. Stable ids preserved.

**Import**
1. Validate schema_version.
2. Preserve provenance and timestamps.

---

## v0 Open Questions

1. JSON Patch vs custom diff format in `events.diff`.
2. Whether to store `summary` separately for each entity type.
3. How strict to make schema validation for agent writes.

