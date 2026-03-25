import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ulid } from "ulid";
import { config } from "./config.js";
import {
  ActorContext,
  Artifact,
  Brief,
  Conflict,
  Entity,
  EntityType,
  EventRecord,
  EventType,
  FieldProvenanceEntry,
  GraphQuery,
  Observation,
  ObservationLifecycle,
  Provenance,
  Relationship,
  SearchFilter,
  SearchParams,
  VerificationStatus,
} from "./models.js";

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) db = initDb();
  return db;
}

export function initDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? config.dbPath;
  const dbDir = path.dirname(resolvedPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const database = new Database(resolvedPath);
  database.pragma("journal_mode = WAL");

  database.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      properties TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT,
      confidence REAL,
      verification TEXT,
      provenance TEXT
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      type TEXT NOT NULL,
      metadata TEXT,
      confidence REAL,
      verification TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      event_id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      diff TEXT,
      actor TEXT,
      prompt_hash TEXT,
      tool_call_id TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS field_provenance (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      field_path TEXT NOT NULL,
      provenance TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idempotency (
      key TEXT NOT NULL,
      operation TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (key, operation)
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      artifact_type TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      participants TEXT NOT NULL DEFAULT '[]',
      source_url TEXT,
      recorded_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      artifact_id TEXT,
      observation_type TEXT NOT NULL,
      field_path TEXT,
      value TEXT NOT NULL,
      snippet TEXT,
      lifecycle TEXT NOT NULL DEFAULT 'current',
      superseded_by TEXT,
      as_of TEXT NOT NULL,
      valid_until TEXT,
      confidence REAL,
      verification TEXT,
      created_at TEXT NOT NULL,
      actor TEXT
    );

    CREATE TABLE IF NOT EXISTS briefs (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      brief_type TEXT NOT NULL,
      content TEXT NOT NULL,
      observation_ids TEXT NOT NULL DEFAULT '[]',
      policy_version TEXT,
      generated_at TEXT NOT NULL,
      generated_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conflicts (
      id TEXT PRIMARY KEY,
      observation_ids TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      field_path TEXT,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      resolution TEXT,
      resolved_at TEXT,
      resolved_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS entity_fts USING fts5(
      entity_id UNINDEXED,
      content
    );

    CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);
    CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_id);
    CREATE INDEX IF NOT EXISTS idx_observations_entity ON observations(entity_id);
    CREATE INDEX IF NOT EXISTS idx_observations_artifact ON observations(artifact_id);
    CREATE INDEX IF NOT EXISTS idx_observations_lifecycle ON observations(lifecycle);
    CREATE INDEX IF NOT EXISTS idx_briefs_entity ON briefs(entity_id);
    CREATE INDEX IF NOT EXISTS idx_conflicts_entity ON conflicts(entity_id);
    CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);
  `);

  db = database;
  return database;
}

// Initialize on first import
getDb();

export function nowIso() {
  return new Date().toISOString();
}

export function generateId() {
  return ulid();
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ── Row mappers ────────────────────────────────────────────────────

function toEntity(row: any): Entity {
  return {
    id: row.id,
    type: row.type,
    properties: parseJson(row.properties, {}),
    schema_version: row.schema_version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.status,
    summary: row.summary,
    confidence: row.confidence,
    verification: row.verification,
    provenance: parseJson(row.provenance, null),
  };
}

function toRelationship(row: any): Relationship {
  return {
    id: row.id,
    from_id: row.from_id,
    to_id: row.to_id,
    type: row.type,
    metadata: parseJson(row.metadata, null),
    confidence: row.confidence,
    verification: row.verification,
    created_at: row.created_at,
  };
}

function toEvent(row: any): EventRecord {
  return {
    event_id: row.event_id,
    entity_id: row.entity_id,
    event_type: row.event_type,
    diff: parseJson(row.diff, null),
    actor: row.actor,
    prompt_hash: row.prompt_hash,
    tool_call_id: row.tool_call_id,
    timestamp: row.timestamp,
  };
}

function toArtifact(row: any): Artifact {
  return {
    id: row.id,
    artifact_type: row.artifact_type,
    title: row.title,
    content: row.content,
    content_hash: row.content_hash,
    participants: parseJson(row.participants, []),
    source_url: row.source_url,
    recorded_at: row.recorded_at,
    created_at: row.created_at,
    metadata: parseJson(row.metadata, null),
  };
}

function toObservation(row: any): Observation {
  return {
    id: row.id,
    entity_id: row.entity_id,
    artifact_id: row.artifact_id,
    observation_type: row.observation_type,
    field_path: row.field_path,
    value: parseJson(row.value, row.value),
    snippet: row.snippet,
    lifecycle: row.lifecycle,
    superseded_by: row.superseded_by,
    as_of: row.as_of,
    valid_until: row.valid_until,
    confidence: row.confidence,
    verification: row.verification,
    created_at: row.created_at,
    actor: row.actor,
  };
}

function toBrief(row: any): Brief {
  return {
    id: row.id,
    entity_id: row.entity_id,
    brief_type: row.brief_type,
    content: row.content,
    observation_ids: parseJson(row.observation_ids, []),
    policy_version: row.policy_version,
    generated_at: row.generated_at,
    generated_by: row.generated_by,
    created_at: row.created_at,
  };
}

function toConflict(row: any): Conflict {
  return {
    id: row.id,
    observation_ids: parseJson(row.observation_ids, []),
    entity_id: row.entity_id,
    field_path: row.field_path,
    description: row.description,
    status: row.status,
    resolution: row.resolution,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
    created_at: row.created_at,
  };
}

// ── FTS helpers ────────────────────────────────────────────────────

function collectStringLike(value: unknown, out: string[]) {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    out.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringLike(item, out);
    }
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStringLike(item, out);
    }
  }
}

function buildFtsContent(entity: Entity): string {
  const parts: string[] = [];
  if (entity.summary) parts.push(entity.summary);
  collectStringLike(entity.properties, parts);
  return parts.join(" ");
}

function upsertFts(entity: Entity) {
  const content = buildFtsContent(entity);
  const deleteStmt = getDb().prepare("DELETE FROM entity_fts WHERE entity_id = ?");
  const insertStmt = getDb().prepare(
    "INSERT INTO entity_fts(entity_id, content) VALUES (?, ?)"
  );
  const tx = getDb().transaction(() => {
    deleteStmt.run(entity.id);
    insertStmt.run(entity.id, content);
  });
  tx();
}

// ── Event ledger ───────────────────────────────────────────────────

function recordEvent(
  entityId: string,
  eventType: EventType,
  diff: unknown,
  context?: ActorContext
) {
  const event: EventRecord = {
    event_id: generateId(),
    entity_id: entityId,
    event_type: eventType,
    diff,
    actor: context?.actor ?? null,
    prompt_hash: context?.prompt_hash ?? null,
    tool_call_id: context?.tool_call_id ?? null,
    timestamp: nowIso(),
  };

  getDb().prepare(
    `INSERT INTO events(event_id, entity_id, event_type, diff, actor, prompt_hash, tool_call_id, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    event.event_id,
    event.entity_id,
    event.event_type,
    JSON.stringify(event.diff ?? null),
    event.actor,
    event.prompt_hash,
    event.tool_call_id,
    event.timestamp
  );
}

// ── Entities ───────────────────────────────────────────────────────

export function getEntity(id: string): Entity | null {
  const row = getDb().prepare("SELECT * FROM entities WHERE id = ?").get(id);
  return row ? toEntity(row) : null;
}

export function listEntityFieldProvenance(entityId: string): FieldProvenanceEntry[] {
  const rows = getDb()
    .prepare("SELECT * FROM field_provenance WHERE entity_id = ?")
    .all(entityId);
  return rows.map((row: any) => ({
    id: row.id,
    entity_id: row.entity_id,
    field_path: row.field_path,
    provenance: parseJson(row.provenance, {}),
  }));
}

function upsertFieldProvenance(
  entityId: string,
  entries: { field_path: string; provenance: Provenance }[]
) {
  const deleteStmt = getDb().prepare(
    "DELETE FROM field_provenance WHERE entity_id = ? AND field_path = ?"
  );
  const insertStmt = getDb().prepare(
    "INSERT INTO field_provenance(id, entity_id, field_path, provenance) VALUES (?, ?, ?, ?)"
  );

  const transaction = getDb().transaction(() => {
    for (const entry of entries) {
      deleteStmt.run(entityId, entry.field_path);
      insertStmt.run(
        generateId(),
        entityId,
        entry.field_path,
        JSON.stringify(entry.provenance ?? {})
      );
    }
  });

  transaction();
}

export function createEntity(input: {
  id?: string;
  type: EntityType;
  properties?: Record<string, unknown>;
  summary?: string | null;
  confidence?: number | null;
  verification?: VerificationStatus | null;
  provenance?: Provenance | null;
  status?: "active" | "archived";
  schema_version?: string;
  field_provenance?: { field_path: string; provenance: Provenance }[];
}, context?: ActorContext): Entity {
  const now = nowIso();
  const entity: Entity = {
    id: input.id ?? generateId(),
    type: input.type,
    properties: input.properties ?? {},
    schema_version: input.schema_version ?? config.schemaVersion,
    created_at: now,
    updated_at: now,
    status: input.status ?? "active",
    summary: input.summary ?? null,
    confidence: input.confidence ?? null,
    verification: input.verification ?? null,
    provenance: input.provenance ?? null,
  };

  getDb().prepare(
    `INSERT INTO entities(
      id, type, properties, schema_version, created_at, updated_at, status,
      summary, confidence, verification, provenance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entity.id,
    entity.type,
    JSON.stringify(entity.properties),
    entity.schema_version,
    entity.created_at,
    entity.updated_at,
    entity.status,
    entity.summary,
    entity.confidence,
    entity.verification,
    JSON.stringify(entity.provenance ?? null)
  );

  if (input.field_provenance && input.field_provenance.length > 0) {
    upsertFieldProvenance(entity.id, input.field_provenance);
  }

  upsertFts(entity);
  recordEvent(entity.id, "create", { after: entity }, context);

  return entity;
}

export function updateEntity(
  id: string,
  patch: {
    properties?: Record<string, unknown>;
    replace_properties?: boolean;
    summary?: string | null;
    confidence?: number | null;
    verification?: VerificationStatus | null;
    provenance?: Provenance | null;
    status?: "active" | "archived";
    field_provenance?: { field_path: string; provenance: Provenance }[];
  },
  context?: ActorContext
): Entity | null {
  const current = getEntity(id);
  if (!current) return null;

  const nextProperties = patch.replace_properties
    ? patch.properties ?? {}
    : { ...current.properties, ...(patch.properties ?? {}) };

  const updated: Entity = {
    ...current,
    properties: nextProperties,
    summary: "summary" in patch ? (patch.summary ?? null) : (current.summary ?? null),
    confidence: "confidence" in patch ? (patch.confidence ?? null) : (current.confidence ?? null),
    verification: "verification" in patch ? (patch.verification ?? null) : (current.verification ?? null),
    provenance: "provenance" in patch ? (patch.provenance ?? null) : (current.provenance ?? null),
    status: patch.status ?? current.status,
    updated_at: nowIso(),
  };

  getDb().prepare(
    `UPDATE entities SET
      properties = ?,
      updated_at = ?,
      status = ?,
      summary = ?,
      confidence = ?,
      verification = ?,
      provenance = ?
     WHERE id = ?`
  ).run(
    JSON.stringify(updated.properties),
    updated.updated_at,
    updated.status,
    updated.summary,
    updated.confidence,
    updated.verification,
    JSON.stringify(updated.provenance ?? null),
    updated.id
  );

  if (patch.field_provenance && patch.field_provenance.length > 0) {
    upsertFieldProvenance(updated.id, patch.field_provenance);
  }

  upsertFts(updated);
  recordEvent(updated.id, "update", { before: current, after: updated }, context);

  return updated;
}

export function archiveEntity(id: string, context?: ActorContext): Entity | null {
  return updateEntity(id, { status: "archived" }, context);
}

// ── Relationships ──────────────────────────────────────────────────

export function createRelationship(input: {
  id?: string;
  from_id: string;
  to_id: string;
  type: string;
  metadata?: Record<string, unknown> | null;
  confidence?: number | null;
  verification?: VerificationStatus | null;
}, context?: ActorContext): Relationship {
  const relationship: Relationship = {
    id: input.id ?? generateId(),
    from_id: input.from_id,
    to_id: input.to_id,
    type: input.type,
    metadata: input.metadata ?? null,
    confidence: input.confidence ?? null,
    verification: input.verification ?? null,
    created_at: nowIso(),
  };

  getDb().prepare(
    `INSERT INTO relationships(
      id, from_id, to_id, type, metadata, confidence, verification, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    relationship.id,
    relationship.from_id,
    relationship.to_id,
    relationship.type,
    JSON.stringify(relationship.metadata ?? null),
    relationship.confidence,
    relationship.verification,
    relationship.created_at
  );

  recordEvent(relationship.id, "create", { relationship }, context);

  return relationship;
}

export function listRelationships(params: {
  entity_id?: string;
  type?: string;
  limit?: number;
  offset?: number;
}): Relationship[] {
  const where: string[] = [];
  const values: unknown[] = [];

  if (params.entity_id) {
    where.push("(from_id = ? OR to_id = ?)");
    values.push(params.entity_id, params.entity_id);
  }
  if (params.type) {
    where.push("type = ?");
    values.push(params.type);
  }

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const sql = `SELECT * FROM relationships ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  values.push(limit, offset);

  return getDb().prepare(sql).all(...values).map(toRelationship);
}

export function countRelationships(params: { entity_id?: string; type?: string }): number {
  const where: string[] = [];
  const values: unknown[] = [];
  if (params.entity_id) {
    where.push("(from_id = ? OR to_id = ?)");
    values.push(params.entity_id, params.entity_id);
  }
  if (params.type) {
    where.push("type = ?");
    values.push(params.type);
  }
  const sql = `SELECT COUNT(*) as cnt FROM relationships ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  const row = getDb().prepare(sql).get(...values) as { cnt: number };
  return row.cnt;
}

export function deleteRelationship(id: string, context?: ActorContext): boolean {
  const existing = getDb()
    .prepare("SELECT * FROM relationships WHERE id = ?")
    .get(id);
  if (!existing) return false;

  getDb().prepare("DELETE FROM relationships WHERE id = ?").run(id);
  recordEvent(id, "delete", { relationship: existing }, context);
  return true;
}

// ── Search ─────────────────────────────────────────────────────────

function validateFilterField(field: string): { sql: string; valueField: string } {
  const baseFields = new Set([
    "id",
    "type",
    "status",
    "created_at",
    "updated_at",
    "confidence",
    "verification",
    "summary",
  ]);

  if (baseFields.has(field)) {
    return { sql: `e.${field}`, valueField: field };
  }

  if (field.startsWith("properties.")) {
    const key = field.slice("properties.".length);
    if (!/^[a-zA-Z0-9_]+$/.test(key)) {
      throw new Error("Invalid properties field");
    }
    return { sql: `json_extract(e.properties, '$.${key}')`, valueField: key };
  }

  throw new Error(`Unsupported field: ${field}`);
}

function buildFilterSql(filters: SearchFilter[], values: unknown[]) {
  const clauses: string[] = [];

  for (const filter of filters) {
    const allowedOps = new Set(["=", "!=", ">", ">=", "<", "<=", "LIKE"]);
    if (!allowedOps.has(filter.op)) {
      throw new Error(`Unsupported op: ${filter.op}`);
    }

    const { sql } = validateFilterField(filter.field);
    clauses.push(`${sql} ${filter.op} ?`);
    values.push(filter.value);
  }

  return clauses;
}

export function searchEntities(params: SearchParams) {
  const values: unknown[] = [];
  const where: string[] = [];
  const joins: string[] = [];

  if (params.type) {
    where.push("e.type = ?");
    values.push(params.type);
  }

  if (params.q) {
    joins.push("JOIN entity_fts fts ON fts.entity_id = e.id");
    where.push("entity_fts MATCH ?");
    values.push(params.q);
  }

  if (params.filters && params.filters.length > 0) {
    const clauses = buildFilterSql(params.filters, values);
    where.push(...clauses);
  }

  const sort = params.sort ? validateFilterField(params.sort).sql : "e.updated_at";
  const order = params.order?.toLowerCase() === "asc" ? "ASC" : "DESC";
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const sql = `
    SELECT e.*
    FROM entities e
    ${joins.join(" ")}
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY ${sort} ${order}
    LIMIT ? OFFSET ?
  `;

  values.push(limit, offset);

  const rows = getDb().prepare(sql).all(...values);
  return rows.map(toEntity);
}

export function countEntities(params: SearchParams): number {
  const values: unknown[] = [];
  const where: string[] = [];
  const joins: string[] = [];

  if (params.type) {
    where.push("e.type = ?");
    values.push(params.type);
  }
  if (params.q) {
    joins.push("JOIN entity_fts fts ON fts.entity_id = e.id");
    where.push("entity_fts MATCH ?");
    values.push(params.q);
  }
  if (params.filters && params.filters.length > 0) {
    const clauses = buildFilterSql(params.filters, values);
    where.push(...clauses);
  }

  const sql = `SELECT COUNT(*) as cnt FROM entities e ${joins.join(" ")} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  const row = getDb().prepare(sql).get(...values) as { cnt: number };
  return row.cnt;
}

// ── Graph ──────────────────────────────────────────────────────────

export function traverseGraph(query: GraphQuery) {
  const direction = query.direction ?? "both";
  const depth = Math.min(Math.max(query.depth ?? 1, 1), 3);
  const limit = Math.min(query.limit ?? 100, 500);
  const relType = query.type;

  const visited = new Set<string>();
  const seenEdges = new Set<string>();
  const edges: Relationship[] = [];
  const nodes = new Map<string, Entity>();

  let frontier = [query.entity_id];
  visited.add(query.entity_id);

  for (let level = 0; level < depth; level += 1) {
    const nextFrontier: string[] = [];

    for (const entityId of frontier) {
      if (edges.length >= limit) break;

      const clauses: string[] = [];
      const values: unknown[] = [];

      if (direction === "out" || direction === "both") {
        clauses.push("from_id = ?");
        values.push(entityId);
      }
      if (direction === "in" || direction === "both") {
        clauses.push("to_id = ?");
        values.push(entityId);
      }

      if (clauses.length === 0) continue;
      const directionSql = clauses.length > 1 ? `(${clauses.join(" OR ")})` : clauses[0];
      const whereParts = [directionSql];
      if (relType) {
        whereParts.push("type = ?");
        values.push(relType);
      }

      const sql = `SELECT * FROM relationships WHERE ${whereParts.join(" AND ")}`;
      const relRows = getDb().prepare(sql).all(...values);

      for (const row of relRows) {
        if (edges.length >= limit) break;
        const rel = toRelationship(row);
        if (seenEdges.has(rel.id)) continue;
        seenEdges.add(rel.id);
        edges.push(rel);

        const otherId = rel.from_id === entityId ? rel.to_id : rel.from_id;
        if (!visited.has(otherId)) {
          visited.add(otherId);
          nextFrontier.push(otherId);
        }
      }
    }

    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  const uniqueIds = Array.from(visited);
  for (const id of uniqueIds) {
    const entity = getEntity(id);
    if (entity) nodes.set(id, entity);
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
  };
}

// ── Events ─────────────────────────────────────────────────────────

export function listEvents(entityId: string, limit = 50, offset = 0) {
  const rows = getDb()
    .prepare(
      "SELECT * FROM events WHERE entity_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    )
    .all(entityId, limit, offset);
  return rows.map(toEvent);
}

export function countEvents(entityId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as cnt FROM events WHERE entity_id = ?")
    .get(entityId) as { cnt: number };
  return row.cnt;
}

// ── Idempotency ────────────────────────────────────────────────────

export function getIdempotentResponse(operation: string, key: string) {
  const row = getDb()
    .prepare(
      "SELECT status_code, response_json FROM idempotency WHERE key = ? AND operation = ?"
    )
    .get(key, operation) as { status_code: number; response_json: string } | undefined;
  if (!row) return null;
  return {
    status_code: row.status_code,
    response: parseJson(row.response_json, null),
  };
}

export function storeIdempotentResponse(
  operation: string,
  key: string,
  statusCode: number,
  response: unknown
) {
  getDb().prepare(
    `INSERT OR REPLACE INTO idempotency(key, operation, status_code, response_json, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(key, operation, statusCode, JSON.stringify(response), nowIso());
}

// ── Artifacts ──────────────────────────────────────────────────────

export function createArtifact(input: {
  artifact_type: string;
  title?: string | null;
  content: string;
  participants?: string[];
  source_url?: string | null;
  recorded_at?: string;
  metadata?: Record<string, unknown> | null;
}): Artifact {
  const now = nowIso();
  const artifact: Artifact = {
    id: generateId(),
    artifact_type: input.artifact_type as Artifact["artifact_type"],
    title: input.title ?? null,
    content: input.content,
    content_hash: crypto.createHash("sha256").update(input.content).digest("hex"),
    participants: input.participants ?? [],
    source_url: input.source_url ?? null,
    recorded_at: input.recorded_at ?? now,
    created_at: now,
    metadata: input.metadata ?? null,
  };

  getDb().prepare(
    `INSERT INTO artifacts(id, artifact_type, title, content, content_hash, participants, source_url, recorded_at, created_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    artifact.id,
    artifact.artifact_type,
    artifact.title,
    artifact.content,
    artifact.content_hash,
    JSON.stringify(artifact.participants),
    artifact.source_url,
    artifact.recorded_at,
    artifact.created_at,
    JSON.stringify(artifact.metadata)
  );

  return artifact;
}

export function getArtifact(id: string): Artifact | null {
  const row = getDb().prepare("SELECT * FROM artifacts WHERE id = ?").get(id);
  return row ? toArtifact(row) : null;
}

export function listArtifacts(params: {
  artifact_type?: string;
  limit?: number;
  offset?: number;
}): Artifact[] {
  const where: string[] = [];
  const values: unknown[] = [];

  if (params.artifact_type) {
    where.push("artifact_type = ?");
    values.push(params.artifact_type);
  }

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const sql = `SELECT * FROM artifacts ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  values.push(limit, offset);

  return getDb().prepare(sql).all(...values).map(toArtifact);
}

export function countArtifacts(params: { artifact_type?: string }): number {
  const where: string[] = [];
  const values: unknown[] = [];
  if (params.artifact_type) {
    where.push("artifact_type = ?");
    values.push(params.artifact_type);
  }
  const sql = `SELECT COUNT(*) as cnt FROM artifacts ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  const row = getDb().prepare(sql).get(...values) as { cnt: number };
  return row.cnt;
}

// ── Observations ───────────────────────────────────────────────────

export function createObservation(input: {
  entity_id: string;
  artifact_id?: string | null;
  observation_type: string;
  field_path?: string | null;
  value: unknown;
  snippet?: string | null;
  confidence?: number | null;
  verification?: VerificationStatus | null;
  as_of?: string;
  valid_until?: string | null;
  actor?: string | null;
}): Observation {
  const now = nowIso();
  const observation: Observation = {
    id: generateId(),
    entity_id: input.entity_id,
    artifact_id: input.artifact_id ?? null,
    observation_type: input.observation_type,
    field_path: input.field_path ?? null,
    value: input.value,
    snippet: input.snippet ?? null,
    lifecycle: "current",
    superseded_by: null,
    as_of: input.as_of ?? now,
    valid_until: input.valid_until ?? null,
    confidence: input.confidence ?? null,
    verification: input.verification ?? null,
    created_at: now,
    actor: input.actor ?? null,
  };

  getDb().prepare(
    `INSERT INTO observations(id, entity_id, artifact_id, observation_type, field_path, value, snippet, lifecycle, superseded_by, as_of, valid_until, confidence, verification, created_at, actor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    observation.id,
    observation.entity_id,
    observation.artifact_id,
    observation.observation_type,
    observation.field_path,
    JSON.stringify(observation.value),
    observation.snippet,
    observation.lifecycle,
    observation.superseded_by,
    observation.as_of,
    observation.valid_until,
    observation.confidence,
    observation.verification,
    observation.created_at,
    observation.actor
  );

  return observation;
}

export function getObservation(id: string): Observation | null {
  const row = getDb().prepare("SELECT * FROM observations WHERE id = ?").get(id);
  return row ? toObservation(row) : null;
}

export function listObservations(params: {
  entity_id?: string;
  artifact_id?: string;
  lifecycle?: string;
  limit?: number;
  offset?: number;
}): Observation[] {
  const where: string[] = [];
  const values: unknown[] = [];

  if (params.entity_id) {
    where.push("entity_id = ?");
    values.push(params.entity_id);
  }
  if (params.artifact_id) {
    where.push("artifact_id = ?");
    values.push(params.artifact_id);
  }
  if (params.lifecycle) {
    where.push("lifecycle = ?");
    values.push(params.lifecycle);
  }

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const sql = `SELECT * FROM observations ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  values.push(limit, offset);

  return getDb().prepare(sql).all(...values).map(toObservation);
}

export function countObservations(params: { entity_id?: string; artifact_id?: string; lifecycle?: string }): number {
  const where: string[] = [];
  const values: unknown[] = [];
  if (params.entity_id) { where.push("entity_id = ?"); values.push(params.entity_id); }
  if (params.artifact_id) { where.push("artifact_id = ?"); values.push(params.artifact_id); }
  if (params.lifecycle) { where.push("lifecycle = ?"); values.push(params.lifecycle); }
  const sql = `SELECT COUNT(*) as cnt FROM observations ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  const row = getDb().prepare(sql).get(...values) as { cnt: number };
  return row.cnt;
}

export function updateObservationLifecycle(
  id: string,
  lifecycle: ObservationLifecycle,
  superseded_by?: string
): Observation | null {
  const row = getDb().prepare("SELECT * FROM observations WHERE id = ?").get(id);
  if (!row) return null;

  getDb().prepare(
    "UPDATE observations SET lifecycle = ?, superseded_by = ? WHERE id = ?"
  ).run(lifecycle, superseded_by ?? null, id);

  const updated = getDb().prepare("SELECT * FROM observations WHERE id = ?").get(id);
  return updated ? toObservation(updated) : null;
}

// ── Briefs ─────────────────────────────────────────────────────────

export function createBrief(input: {
  entity_id: string;
  brief_type: string;
  content: string;
  observation_ids: string[];
  policy_version?: string | null;
  generated_by?: string | null;
}): Brief {
  const now = nowIso();
  const brief: Brief = {
    id: generateId(),
    entity_id: input.entity_id,
    brief_type: input.brief_type,
    content: input.content,
    observation_ids: input.observation_ids,
    policy_version: input.policy_version ?? null,
    generated_at: now,
    generated_by: input.generated_by ?? null,
    created_at: now,
  };

  getDb().prepare(
    `INSERT INTO briefs(id, entity_id, brief_type, content, observation_ids, policy_version, generated_at, generated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    brief.id,
    brief.entity_id,
    brief.brief_type,
    brief.content,
    JSON.stringify(brief.observation_ids),
    brief.policy_version,
    brief.generated_at,
    brief.generated_by,
    brief.created_at
  );

  return brief;
}

export function getBrief(id: string): Brief | null {
  const row = getDb().prepare("SELECT * FROM briefs WHERE id = ?").get(id);
  return row ? toBrief(row) : null;
}

export function listBriefs(params: {
  entity_id?: string;
  brief_type?: string;
  limit?: number;
  offset?: number;
}): Brief[] {
  const where: string[] = [];
  const values: unknown[] = [];

  if (params.entity_id) {
    where.push("entity_id = ?");
    values.push(params.entity_id);
  }
  if (params.brief_type) {
    where.push("brief_type = ?");
    values.push(params.brief_type);
  }

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const sql = `SELECT * FROM briefs ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY generated_at DESC LIMIT ? OFFSET ?`;
  values.push(limit, offset);

  return getDb().prepare(sql).all(...values).map(toBrief);
}

export function countBriefs(params: { entity_id?: string; brief_type?: string }): number {
  const where: string[] = [];
  const values: unknown[] = [];
  if (params.entity_id) { where.push("entity_id = ?"); values.push(params.entity_id); }
  if (params.brief_type) { where.push("brief_type = ?"); values.push(params.brief_type); }
  const sql = `SELECT COUNT(*) as cnt FROM briefs ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  const row = getDb().prepare(sql).get(...values) as { cnt: number };
  return row.cnt;
}

// ── Conflicts ──────────────────────────────────────────────────────

export function createConflict(input: {
  observation_ids: string[];
  entity_id: string;
  field_path?: string | null;
  description: string;
}): Conflict {
  const now = nowIso();
  const conflict: Conflict = {
    id: generateId(),
    observation_ids: input.observation_ids,
    entity_id: input.entity_id,
    field_path: input.field_path ?? null,
    description: input.description,
    status: "open",
    resolution: null,
    resolved_at: null,
    resolved_by: null,
    created_at: now,
  };

  getDb().prepare(
    `INSERT INTO conflicts(id, observation_ids, entity_id, field_path, description, status, resolution, resolved_at, resolved_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    conflict.id,
    JSON.stringify(conflict.observation_ids),
    conflict.entity_id,
    conflict.field_path,
    conflict.description,
    conflict.status,
    conflict.resolution,
    conflict.resolved_at,
    conflict.resolved_by,
    conflict.created_at
  );

  return conflict;
}

export function getConflict(id: string): Conflict | null {
  const row = getDb().prepare("SELECT * FROM conflicts WHERE id = ?").get(id);
  return row ? toConflict(row) : null;
}

export function listConflicts(params: {
  entity_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Conflict[] {
  const where: string[] = [];
  const values: unknown[] = [];

  if (params.entity_id) {
    where.push("entity_id = ?");
    values.push(params.entity_id);
  }
  if (params.status) {
    where.push("status = ?");
    values.push(params.status);
  }

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const sql = `SELECT * FROM conflicts ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  values.push(limit, offset);

  return getDb().prepare(sql).all(...values).map(toConflict);
}

export function countConflicts(params: { entity_id?: string; status?: string }): number {
  const where: string[] = [];
  const values: unknown[] = [];
  if (params.entity_id) { where.push("entity_id = ?"); values.push(params.entity_id); }
  if (params.status) { where.push("status = ?"); values.push(params.status); }
  const sql = `SELECT COUNT(*) as cnt FROM conflicts ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
  const row = getDb().prepare(sql).get(...values) as { cnt: number };
  return row.cnt;
}

export function resolveConflict(
  id: string,
  resolution: string,
  resolved_by?: string | null
): Conflict | null {
  const row = getDb().prepare("SELECT * FROM conflicts WHERE id = ?").get(id);
  if (!row) return null;

  const now = nowIso();
  getDb().prepare(
    "UPDATE conflicts SET status = 'resolved', resolution = ?, resolved_at = ?, resolved_by = ? WHERE id = ?"
  ).run(resolution, now, resolved_by ?? null, id);

  const updated = getDb().prepare("SELECT * FROM conflicts WHERE id = ?").get(id);
  return updated ? toConflict(updated) : null;
}

// ── Import / Export ────────────────────────────────────────────────

export function exportAll() {
  const entities = getDb().prepare("SELECT * FROM entities").all().map(toEntity);
  const relationships = getDb().prepare("SELECT * FROM relationships").all().map(toRelationship);
  const events = getDb().prepare("SELECT * FROM events ORDER BY timestamp ASC").all().map(toEvent);
  const field_provenance = getDb().prepare("SELECT * FROM field_provenance").all().map((row: any) => ({
    id: row.id,
    entity_id: row.entity_id,
    field_path: row.field_path,
    provenance: parseJson(row.provenance, {}),
  }));
  const artifacts = getDb().prepare("SELECT * FROM artifacts").all().map(toArtifact);
  const observations = getDb().prepare("SELECT * FROM observations").all().map(toObservation);
  const briefs = getDb().prepare("SELECT * FROM briefs").all().map(toBrief);
  const conflicts = getDb().prepare("SELECT * FROM conflicts").all().map(toConflict);

  return {
    version: "1",
    exported_at: nowIso(),
    entities,
    relationships,
    events,
    field_provenance,
    artifacts,
    observations,
    briefs,
    conflicts,
  };
}

export function importAll(data: {
  entities?: any[];
  relationships?: any[];
  events?: any[];
  field_provenance?: any[];
  artifacts?: any[];
  observations?: any[];
  briefs?: any[];
  conflicts?: any[];
}) {
  const stats = {
    entities: 0,
    relationships: 0,
    events: 0,
    field_provenance: 0,
    artifacts: 0,
    observations: 0,
    briefs: 0,
    conflicts: 0,
  };

  const tx = getDb().transaction(() => {
    if (data.entities) {
      const stmt = getDb().prepare(
        `INSERT OR REPLACE INTO entities(id, type, properties, schema_version, created_at, updated_at, status, summary, confidence, verification, provenance)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const e of data.entities) {
        stmt.run(e.id, e.type, JSON.stringify(e.properties), e.schema_version, e.created_at, e.updated_at, e.status, e.summary, e.confidence, e.verification, JSON.stringify(e.provenance));
        upsertFts(e);
        stats.entities++;
      }
    }

    if (data.relationships) {
      const stmt = getDb().prepare(
        `INSERT OR REPLACE INTO relationships(id, from_id, to_id, type, metadata, confidence, verification, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const r of data.relationships) {
        stmt.run(r.id, r.from_id, r.to_id, r.type, JSON.stringify(r.metadata), r.confidence, r.verification, r.created_at);
        stats.relationships++;
      }
    }

    if (data.events) {
      const stmt = getDb().prepare(
        `INSERT OR REPLACE INTO events(event_id, entity_id, event_type, diff, actor, prompt_hash, tool_call_id, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const ev of data.events) {
        stmt.run(ev.event_id, ev.entity_id, ev.event_type, JSON.stringify(ev.diff), ev.actor, ev.prompt_hash, ev.tool_call_id, ev.timestamp);
        stats.events++;
      }
    }

    if (data.field_provenance) {
      const stmt = getDb().prepare(
        `INSERT OR REPLACE INTO field_provenance(id, entity_id, field_path, provenance) VALUES (?, ?, ?, ?)`
      );
      for (const fp of data.field_provenance) {
        stmt.run(fp.id, fp.entity_id, fp.field_path, JSON.stringify(fp.provenance));
        stats.field_provenance++;
      }
    }

    if (data.artifacts) {
      const stmt = getDb().prepare(
        `INSERT OR REPLACE INTO artifacts(id, artifact_type, title, content, content_hash, participants, source_url, recorded_at, created_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const a of data.artifacts) {
        stmt.run(a.id, a.artifact_type, a.title, a.content, a.content_hash, JSON.stringify(a.participants), a.source_url, a.recorded_at, a.created_at, JSON.stringify(a.metadata));
        stats.artifacts++;
      }
    }

    if (data.observations) {
      const stmt = getDb().prepare(
        `INSERT OR REPLACE INTO observations(id, entity_id, artifact_id, observation_type, field_path, value, snippet, lifecycle, superseded_by, as_of, valid_until, confidence, verification, created_at, actor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const o of data.observations) {
        stmt.run(o.id, o.entity_id, o.artifact_id, o.observation_type, o.field_path, JSON.stringify(o.value), o.snippet, o.lifecycle, o.superseded_by, o.as_of, o.valid_until, o.confidence, o.verification, o.created_at, o.actor);
        stats.observations++;
      }
    }

    if (data.briefs) {
      const stmt = getDb().prepare(
        `INSERT OR REPLACE INTO briefs(id, entity_id, brief_type, content, observation_ids, policy_version, generated_at, generated_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const b of data.briefs) {
        stmt.run(b.id, b.entity_id, b.brief_type, b.content, JSON.stringify(b.observation_ids), b.policy_version, b.generated_at, b.generated_by, b.created_at);
        stats.briefs++;
      }
    }

    if (data.conflicts) {
      const stmt = getDb().prepare(
        `INSERT OR REPLACE INTO conflicts(id, observation_ids, entity_id, field_path, description, status, resolution, resolved_at, resolved_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const c of data.conflicts) {
        stmt.run(c.id, JSON.stringify(c.observation_ids), c.entity_id, c.field_path, c.description, c.status, c.resolution, c.resolved_at, c.resolved_by, c.created_at);
        stats.conflicts++;
      }
    }
  });

  tx();
  return stats;
}
