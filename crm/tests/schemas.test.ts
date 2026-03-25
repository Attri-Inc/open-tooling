import { describe, it, expect } from "vitest";
import {
  CreateEntitySchema,
  UpdateEntitySchema,
  CreateRelationshipSchema,
  SearchParamsSchema,
  GraphQuerySchema,
  CreateArtifactSchema,
  CreateObservationSchema,
  CreateBriefSchema,
  CreateConflictSchema,
  ResolveConflictSchema,
} from "../src/schemas.js";

describe("CreateEntitySchema", () => {
  it("accepts valid entity", () => {
    const result = CreateEntitySchema.safeParse({
      type: "contact",
      properties: { full_name: "Alice" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = CreateEntitySchema.safeParse({ type: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing type", () => {
    const result = CreateEntitySchema.safeParse({ properties: {} });
    expect(result.success).toBe(false);
  });

  it("validates confidence range", () => {
    expect(CreateEntitySchema.safeParse({ type: "contact", confidence: 1.5 }).success).toBe(false);
    expect(CreateEntitySchema.safeParse({ type: "contact", confidence: -0.1 }).success).toBe(false);
    expect(CreateEntitySchema.safeParse({ type: "contact", confidence: 0.5 }).success).toBe(true);
  });

  it("validates verification enum", () => {
    expect(CreateEntitySchema.safeParse({ type: "contact", verification: "invalid" }).success).toBe(false);
    expect(CreateEntitySchema.safeParse({ type: "contact", verification: "verified" }).success).toBe(true);
  });
});

describe("CreateRelationshipSchema", () => {
  it("accepts valid relationship", () => {
    const result = CreateRelationshipSchema.safeParse({
      from_id: "a",
      to_id: "b",
      type: "EMPLOYED_AT",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid relationship type", () => {
    const result = CreateRelationshipSchema.safeParse({
      from_id: "a",
      to_id: "b",
      type: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty from_id", () => {
    const result = CreateRelationshipSchema.safeParse({
      from_id: "",
      to_id: "b",
      type: "RELATED_TO",
    });
    expect(result.success).toBe(false);
  });
});

describe("SearchParamsSchema", () => {
  it("accepts empty search", () => {
    expect(SearchParamsSchema.safeParse({}).success).toBe(true);
  });

  it("validates limit range", () => {
    expect(SearchParamsSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(SearchParamsSchema.safeParse({ limit: 201 }).success).toBe(false);
    expect(SearchParamsSchema.safeParse({ limit: 50 }).success).toBe(true);
  });

  it("validates filter ops", () => {
    const valid = SearchParamsSchema.safeParse({
      filters: [{ field: "type", op: "=", value: "contact" }],
    });
    expect(valid.success).toBe(true);

    const invalid = SearchParamsSchema.safeParse({
      filters: [{ field: "type", op: "INVALID", value: "contact" }],
    });
    expect(invalid.success).toBe(false);
  });
});

describe("CreateArtifactSchema", () => {
  it("accepts valid artifact", () => {
    const result = CreateArtifactSchema.safeParse({
      artifact_type: "email",
      content: "Hello world",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid artifact type", () => {
    const result = CreateArtifactSchema.safeParse({
      artifact_type: "invalid",
      content: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty content", () => {
    const result = CreateArtifactSchema.safeParse({
      artifact_type: "note",
      content: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateObservationSchema", () => {
  it("accepts valid observation", () => {
    const result = CreateObservationSchema.safeParse({
      entity_id: "entity-1",
      observation_type: "field_value",
      value: 120000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty entity_id", () => {
    const result = CreateObservationSchema.safeParse({
      entity_id: "",
      observation_type: "field_value",
      value: "test",
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateBriefSchema", () => {
  it("accepts valid brief", () => {
    const result = CreateBriefSchema.safeParse({
      entity_id: "entity-1",
      brief_type: "contact_summary",
      content: "Alice is CTO",
      observation_ids: ["obs-1"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = CreateBriefSchema.safeParse({
      entity_id: "entity-1",
      brief_type: "summary",
      content: "",
      observation_ids: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateConflictSchema", () => {
  it("requires at least 2 observation ids", () => {
    const oneId = CreateConflictSchema.safeParse({
      observation_ids: ["obs-1"],
      entity_id: "e-1",
      description: "Conflict",
    });
    expect(oneId.success).toBe(false);

    const twoIds = CreateConflictSchema.safeParse({
      observation_ids: ["obs-1", "obs-2"],
      entity_id: "e-1",
      description: "Conflict",
    });
    expect(twoIds.success).toBe(true);
  });
});

describe("ResolveConflictSchema", () => {
  it("accepts valid resolution", () => {
    const result = ResolveConflictSchema.safeParse({
      resolution: "Confirmed via call",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty resolution", () => {
    const result = ResolveConflictSchema.safeParse({
      resolution: "",
    });
    expect(result.success).toBe(false);
  });
});
