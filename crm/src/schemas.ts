import { z } from "zod";

// ── Shared primitives ──────────────────────────────────────────────

export const EntityTypeEnum = z.enum([
  "contact",
  "company",
  "deal",
  "interaction",
  "task",
  "agent",
]);

export const VerificationEnum = z.enum([
  "unverified",
  "verified",
  "low_confidence",
]);

export const StatusEnum = z.enum(["active", "archived"]);

export const ProvenanceSchema = z.object({
  source_agent: z.string().optional(),
  tool_call_id: z.string().optional(),
  prompt_hash: z.string().optional(),
  timestamp: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  verification: VerificationEnum.optional(),
});

export const FieldProvenanceInputSchema = z.object({
  field_path: z.string().min(1),
  provenance: ProvenanceSchema,
});

// ── Entity schemas ─────────────────────────────────────────────────

export const CreateEntitySchema = z.object({
  type: EntityTypeEnum,
  properties: z.record(z.unknown()).optional(),
  summary: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  verification: VerificationEnum.nullable().optional(),
  provenance: ProvenanceSchema.nullable().optional(),
  status: StatusEnum.optional(),
  schema_version: z.string().optional(),
  field_provenance: z.array(FieldProvenanceInputSchema).optional(),
});

export const UpdateEntitySchema = z.object({
  properties: z.record(z.unknown()).optional(),
  replace_properties: z.boolean().optional(),
  summary: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  verification: VerificationEnum.nullable().optional(),
  provenance: ProvenanceSchema.nullable().optional(),
  status: StatusEnum.optional(),
  field_provenance: z.array(FieldProvenanceInputSchema).optional(),
});

// ── Relationship schemas ───────────────────────────────────────────

export const RelationshipTypeEnum = z.enum([
  "EMPLOYED_AT",
  "ASSOCIATED_WITH",
  "OWNS",
  "INTERACTED_WITH",
  "CREATED_BY",
  "RELATED_TO",
]);

export const CreateRelationshipSchema = z.object({
  from_id: z.string().min(1),
  to_id: z.string().min(1),
  type: RelationshipTypeEnum,
  metadata: z.record(z.unknown()).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  verification: VerificationEnum.nullable().optional(),
});

// ── Search schemas ─────────────────────────────────────────────────

export const SearchFilterSchema = z.object({
  field: z.string().min(1),
  op: z.enum(["=", "!=", ">", ">=", "<", "<=", "LIKE"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export const SearchParamsSchema = z.object({
  type: EntityTypeEnum.optional(),
  q: z.string().optional(),
  filters: z.array(SearchFilterSchema).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

// ── Graph schemas ──────────────────────────────────────────────────

export const GraphQuerySchema = z.object({
  entity_id: z.string().min(1),
  direction: z.enum(["out", "in", "both"]).optional(),
  type: z.string().optional(),
  depth: z.number().int().min(1).max(3).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

// ── Artifact schemas ───────────────────────────────────────────────

export const ArtifactTypeEnum = z.enum([
  "email",
  "call_transcript",
  "meeting_notes",
  "document",
  "note",
]);

export const CreateArtifactSchema = z.object({
  artifact_type: ArtifactTypeEnum,
  title: z.string().nullable().optional(),
  content: z.string().min(1),
  participants: z.array(z.string()).optional(),
  source_url: z.string().nullable().optional(),
  recorded_at: z.string().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

// ── Observation schemas ────────────────────────────────────────────

export const ObservationLifecycleEnum = z.enum([
  "current",
  "superseded",
  "retracted",
]);

export const CreateObservationSchema = z.object({
  entity_id: z.string().min(1),
  artifact_id: z.string().nullable().optional(),
  observation_type: z.string().min(1),
  field_path: z.string().nullable().optional(),
  value: z.any(),
  snippet: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  verification: VerificationEnum.nullable().optional(),
  as_of: z.string().optional(),
  valid_until: z.string().nullable().optional(),
  actor: z.string().nullable().optional(),
});

// ── Brief schemas ──────────────────────────────────────────────────

export const CreateBriefSchema = z.object({
  entity_id: z.string().min(1),
  brief_type: z.string().min(1),
  content: z.string().min(1),
  observation_ids: z.array(z.string()),
  policy_version: z.string().nullable().optional(),
  generated_by: z.string().nullable().optional(),
});

// ── Conflict schemas ───────────────────────────────────────────────

export const ConflictStatusEnum = z.enum(["open", "resolved"]);

export const CreateConflictSchema = z.object({
  observation_ids: z.array(z.string()).min(2),
  entity_id: z.string().min(1),
  field_path: z.string().nullable().optional(),
  description: z.string().min(1),
});

export const ResolveConflictSchema = z.object({
  resolution: z.string().min(1),
  resolved_by: z.string().nullable().optional(),
});
