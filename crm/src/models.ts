export type EntityType =
  | "contact"
  | "company"
  | "deal"
  | "interaction"
  | "task"
  | "agent";

export type VerificationStatus = "unverified" | "verified" | "low_confidence";

export type EventType = "create" | "update" | "delete" | "merge";

export interface Provenance {
  source_agent?: string;
  tool_call_id?: string;
  prompt_hash?: string;
  timestamp?: string;
  confidence?: number;
  verification?: VerificationStatus;
}

export interface Entity {
  id: string;
  type: EntityType;
  properties: Record<string, unknown>;
  schema_version: string;
  created_at: string;
  updated_at: string;
  status: "active" | "archived";
  summary?: string | null;
  confidence?: number | null;
  verification?: VerificationStatus | null;
  provenance?: Provenance | null;
}

export interface FieldProvenanceEntry {
  id: string;
  entity_id: string;
  field_path: string;
  provenance: Provenance;
}

export interface Relationship {
  id: string;
  from_id: string;
  to_id: string;
  type: string;
  metadata?: Record<string, unknown> | null;
  confidence?: number | null;
  verification?: VerificationStatus | null;
  created_at: string;
}

export interface EventRecord {
  event_id: string;
  entity_id: string;
  event_type: EventType;
  diff?: unknown;
  actor?: string | null;
  prompt_hash?: string | null;
  tool_call_id?: string | null;
  timestamp: string;
}

export interface IdempotencyRecord {
  key: string;
  operation: string;
  status_code: number;
  response_json: unknown;
  created_at: string;
}

export interface SearchFilter {
  field: string;
  op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "LIKE";
  value: string | number | boolean | null;
}

export interface SearchParams {
  type?: EntityType;
  q?: string;
  filters?: SearchFilter[];
  limit?: number;
  offset?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface GraphQuery {
  entity_id: string;
  direction?: "out" | "in" | "both";
  type?: string;
  depth?: number;
  limit?: number;
}

export interface ActorContext {
  actor?: string;
  tool_call_id?: string;
  prompt_hash?: string;
}

// ── Memory Layer ───────────────────────────────────────────────────

export type ArtifactType =
  | "email"
  | "call_transcript"
  | "meeting_notes"
  | "document"
  | "note";

export interface Artifact {
  id: string;
  artifact_type: ArtifactType;
  title: string | null;
  content: string;
  content_hash: string;
  participants: string[];
  source_url: string | null;
  recorded_at: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export type ObservationLifecycle = "current" | "superseded" | "retracted";

export interface Observation {
  id: string;
  entity_id: string;
  artifact_id: string | null;
  observation_type: string;
  field_path: string | null;
  value: unknown;
  snippet: string | null;
  lifecycle: ObservationLifecycle;
  superseded_by: string | null;
  as_of: string;
  valid_until: string | null;
  confidence: number | null;
  verification: VerificationStatus | null;
  created_at: string;
  actor: string | null;
}

export interface Brief {
  id: string;
  entity_id: string;
  brief_type: string;
  content: string;
  observation_ids: string[];
  policy_version: string | null;
  generated_at: string;
  generated_by: string | null;
  created_at: string;
}

export type ConflictStatus = "open" | "resolved";

export interface Conflict {
  id: string;
  observation_ids: string[];
  entity_id: string;
  field_path: string | null;
  description: string;
  status: ConflictStatus;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

