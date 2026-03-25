import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  initDb,
  createEntity,
  getEntity,
  updateEntity,
  archiveEntity,
  createRelationship,
  deleteRelationship,
  listRelationships,
  searchEntities,
  countEntities,
  traverseGraph,
  listEvents,
  listEntityFieldProvenance,
  createArtifact,
  getArtifact,
  listArtifacts,
  createObservation,
  getObservation,
  listObservations,
  updateObservationLifecycle,
  createBrief,
  getBrief,
  listBriefs,
  createConflict,
  getConflict,
  listConflicts,
  resolveConflict,
  exportAll,
  importAll,
} from "../src/db.js";

beforeEach(() => {
  initDb(":memory:");
});

// ── Entities ───────────────────────────────────────────────────────

describe("entities", () => {
  it("creates and retrieves an entity", () => {
    const entity = createEntity({
      type: "contact",
      properties: { full_name: "Alice Smith", email: "alice@example.com" },
      summary: "Key contact",
    });

    expect(entity.id).toBeTruthy();
    expect(entity.type).toBe("contact");
    expect(entity.properties.full_name).toBe("Alice Smith");
    expect(entity.status).toBe("active");
    expect(entity.summary).toBe("Key contact");

    const fetched = getEntity(entity.id);
    expect(fetched).toEqual(entity);
  });

  it("returns null for missing entity", () => {
    expect(getEntity("nonexistent")).toBeNull();
  });

  it("updates an entity with property merge", () => {
    const entity = createEntity({
      type: "company",
      properties: { name: "Acme", industry: "Tech" },
    });

    const updated = updateEntity(entity.id, {
      properties: { size: "50-100" },
      summary: "Updated company",
    });

    expect(updated!.properties.name).toBe("Acme");
    expect(updated!.properties.size).toBe("50-100");
    expect(updated!.summary).toBe("Updated company");
  });

  it("updates an entity with property replace", () => {
    const entity = createEntity({
      type: "company",
      properties: { name: "Acme", industry: "Tech" },
    });

    const updated = updateEntity(entity.id, {
      properties: { name: "NewCo" },
      replace_properties: true,
    });

    expect(updated!.properties.name).toBe("NewCo");
    expect(updated!.properties.industry).toBeUndefined();
  });

  it("archives an entity", () => {
    const entity = createEntity({ type: "deal" });
    const archived = archiveEntity(entity.id);
    expect(archived!.status).toBe("archived");
  });

  it("stores and retrieves field provenance", () => {
    const entity = createEntity({
      type: "contact",
      properties: { email: "test@example.com" },
      field_provenance: [
        {
          field_path: "properties.email",
          provenance: { source_agent: "agent-1", confidence: 0.9 },
        },
      ],
    });

    const fp = listEntityFieldProvenance(entity.id);
    expect(fp).toHaveLength(1);
    expect(fp[0].field_path).toBe("properties.email");
    expect(fp[0].provenance.source_agent).toBe("agent-1");
  });
});

// ── Relationships ──────────────────────────────────────────────────

describe("relationships", () => {
  it("creates and deletes a relationship", () => {
    const contact = createEntity({ type: "contact", properties: { full_name: "Bob" } });
    const company = createEntity({ type: "company", properties: { name: "Acme" } });

    const rel = createRelationship({
      from_id: contact.id,
      to_id: company.id,
      type: "EMPLOYED_AT",
    });

    expect(rel.from_id).toBe(contact.id);
    expect(rel.to_id).toBe(company.id);
    expect(rel.type).toBe("EMPLOYED_AT");

    const deleted = deleteRelationship(rel.id);
    expect(deleted).toBe(true);

    const deletedAgain = deleteRelationship(rel.id);
    expect(deletedAgain).toBe(false);
  });

  it("lists relationships for an entity", () => {
    const a = createEntity({ type: "contact" });
    const b = createEntity({ type: "company" });
    const c = createEntity({ type: "deal" });
    createRelationship({ from_id: a.id, to_id: b.id, type: "EMPLOYED_AT" });
    createRelationship({ from_id: b.id, to_id: c.id, type: "OWNS" });

    const rels = listRelationships({ entity_id: a.id });
    expect(rels).toHaveLength(1);
    expect(rels[0].type).toBe("EMPLOYED_AT");

    const bRels = listRelationships({ entity_id: b.id });
    expect(bRels).toHaveLength(2);
  });
});

// ── Search ─────────────────────────────────────────────────────────

describe("search", () => {
  it("searches by type", () => {
    createEntity({ type: "contact", properties: { full_name: "Alice" } });
    createEntity({ type: "company", properties: { name: "Acme" } });

    const results = searchEntities({ type: "contact" });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("contact");
  });

  it("searches by FTS query", () => {
    createEntity({ type: "contact", properties: { full_name: "Alice Smith" } });
    createEntity({ type: "contact", properties: { full_name: "Bob Jones" } });

    const results = searchEntities({ q: "Alice" });
    expect(results).toHaveLength(1);
    expect(results[0].properties.full_name).toBe("Alice Smith");
  });

  it("searches with filters", () => {
    createEntity({ type: "contact", properties: { full_name: "Alice" }, confidence: 0.9 });
    createEntity({ type: "contact", properties: { full_name: "Bob" }, confidence: 0.3 });

    const results = searchEntities({
      filters: [{ field: "confidence", op: ">", value: 0.5 }],
    });
    expect(results).toHaveLength(1);
    expect(results[0].properties.full_name).toBe("Alice");
  });

  it("counts entities matching search", () => {
    createEntity({ type: "contact", properties: { full_name: "Alice" } });
    createEntity({ type: "contact", properties: { full_name: "Bob" } });
    createEntity({ type: "company", properties: { name: "Acme" } });

    expect(countEntities({ type: "contact" })).toBe(2);
    expect(countEntities({})).toBe(3);
  });

  it("searches with property filters", () => {
    createEntity({ type: "contact", properties: { full_name: "Alice", title: "CTO" } });
    createEntity({ type: "contact", properties: { full_name: "Bob", title: "Engineer" } });

    const results = searchEntities({
      filters: [{ field: "properties.title", op: "=", value: "CTO" }],
    });
    expect(results).toHaveLength(1);
    expect(results[0].properties.full_name).toBe("Alice");
  });
});

// ── Graph ──────────────────────────────────────────────────────────

describe("graph traversal", () => {
  it("traverses relationships", () => {
    const contact = createEntity({ type: "contact", properties: { full_name: "Alice" } });
    const company = createEntity({ type: "company", properties: { name: "Acme" } });
    const deal = createEntity({ type: "deal", properties: { name: "Big Deal" } });

    createRelationship({ from_id: contact.id, to_id: company.id, type: "EMPLOYED_AT" });
    createRelationship({ from_id: company.id, to_id: deal.id, type: "OWNS" });

    const graph = traverseGraph({ entity_id: contact.id, depth: 2 });
    expect(graph.nodes).toHaveLength(3);
    // Edges are deduplicated — each relationship appears once
    expect(graph.edges).toHaveLength(2);
  });

  it("respects direction filter", () => {
    const a = createEntity({ type: "contact" });
    const b = createEntity({ type: "company" });
    createRelationship({ from_id: a.id, to_id: b.id, type: "EMPLOYED_AT" });

    const outGraph = traverseGraph({ entity_id: a.id, direction: "out" });
    expect(outGraph.edges).toHaveLength(1);

    const inGraph = traverseGraph({ entity_id: a.id, direction: "in" });
    expect(inGraph.edges).toHaveLength(0);
  });
});

// ── Events ─────────────────────────────────────────────────────────

describe("events", () => {
  it("records create and update events", () => {
    const entity = createEntity({
      type: "contact",
      properties: { full_name: "Alice" },
    }, { actor: "agent-1" });

    updateEntity(entity.id, { summary: "Updated" }, { actor: "agent-2" });

    const events = listEvents(entity.id);
    expect(events).toHaveLength(2);
    const types = events.map((e) => e.event_type).sort();
    expect(types).toEqual(["create", "update"]);
    const actors = events.map((e) => e.actor).sort();
    expect(actors).toEqual(["agent-1", "agent-2"]);
  });
});

// ── Artifacts ──────────────────────────────────────────────────────

describe("artifacts", () => {
  it("creates and retrieves an artifact", () => {
    const artifact = createArtifact({
      artifact_type: "email",
      title: "Re: Proposal",
      content: "Thanks for the proposal. Budget is $120k.",
      participants: ["entity-1", "entity-2"],
    });

    expect(artifact.id).toBeTruthy();
    expect(artifact.artifact_type).toBe("email");
    expect(artifact.content_hash).toBeTruthy();
    expect(artifact.participants).toEqual(["entity-1", "entity-2"]);

    const fetched = getArtifact(artifact.id);
    expect(fetched).toEqual(artifact);
  });

  it("lists artifacts by type", () => {
    createArtifact({ artifact_type: "email", content: "Email content" });
    createArtifact({ artifact_type: "note", content: "Note content" });

    const emails = listArtifacts({ artifact_type: "email" });
    expect(emails).toHaveLength(1);
    expect(emails[0].artifact_type).toBe("email");

    const all = listArtifacts({});
    expect(all).toHaveLength(2);
  });
});

// ── Observations ───────────────────────────────────────────────────

describe("observations", () => {
  it("creates and retrieves an observation", () => {
    const entity = createEntity({ type: "deal" });
    const artifact = createArtifact({ artifact_type: "email", content: "Budget is $120k" });

    const obs = createObservation({
      entity_id: entity.id,
      artifact_id: artifact.id,
      observation_type: "field_value",
      field_path: "properties.value",
      value: 120000,
      snippet: "Budget is $120k",
      confidence: 0.95,
    });

    expect(obs.id).toBeTruthy();
    expect(obs.lifecycle).toBe("current");
    expect(obs.value).toBe(120000);

    const fetched = getObservation(obs.id);
    expect(fetched).toEqual(obs);
  });

  it("supersedes an observation", () => {
    const entity = createEntity({ type: "deal" });
    const obs1 = createObservation({
      entity_id: entity.id,
      observation_type: "field_value",
      value: 100000,
    });
    const obs2 = createObservation({
      entity_id: entity.id,
      observation_type: "field_value",
      value: 150000,
    });

    const superseded = updateObservationLifecycle(obs1.id, "superseded", obs2.id);
    expect(superseded!.lifecycle).toBe("superseded");
    expect(superseded!.superseded_by).toBe(obs2.id);

    const current = listObservations({ entity_id: entity.id, lifecycle: "current" });
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe(obs2.id);
  });

  it("retracts an observation", () => {
    const entity = createEntity({ type: "contact" });
    const obs = createObservation({
      entity_id: entity.id,
      observation_type: "field_value",
      value: "wrong@email.com",
    });

    const retracted = updateObservationLifecycle(obs.id, "retracted");
    expect(retracted!.lifecycle).toBe("retracted");
  });
});

// ── Briefs ─────────────────────────────────────────────────────────

describe("briefs", () => {
  it("creates and retrieves a brief", () => {
    const entity = createEntity({ type: "contact" });
    const obs = createObservation({
      entity_id: entity.id,
      observation_type: "field_value",
      value: "CTO",
    });

    const brief = createBrief({
      entity_id: entity.id,
      brief_type: "contact_summary",
      content: `Alice is CTO [${obs.id}]. Key decision maker.`,
      observation_ids: [obs.id],
      generated_by: "claude",
    });

    expect(brief.id).toBeTruthy();
    expect(brief.observation_ids).toEqual([obs.id]);

    const fetched = getBrief(brief.id);
    expect(fetched).toEqual(brief);

    const briefs = listBriefs({ entity_id: entity.id });
    expect(briefs).toHaveLength(1);
  });
});

// ── Conflicts ──────────────────────────────────────────────────────

describe("conflicts", () => {
  it("creates, lists, and resolves a conflict", () => {
    const entity = createEntity({ type: "deal" });
    const obs1 = createObservation({
      entity_id: entity.id,
      observation_type: "field_value",
      field_path: "properties.value",
      value: 100000,
    });
    const obs2 = createObservation({
      entity_id: entity.id,
      observation_type: "field_value",
      field_path: "properties.value",
      value: 150000,
    });

    const conflict = createConflict({
      observation_ids: [obs1.id, obs2.id],
      entity_id: entity.id,
      field_path: "properties.value",
      description: "Two different deal values reported",
    });

    expect(conflict.status).toBe("open");
    expect(conflict.observation_ids).toEqual([obs1.id, obs2.id]);

    const open = listConflicts({ status: "open" });
    expect(open).toHaveLength(1);

    const resolved = resolveConflict(conflict.id, "Confirmed $150k via follow-up call", "agent-1");
    expect(resolved!.status).toBe("resolved");
    expect(resolved!.resolution).toBe("Confirmed $150k via follow-up call");
    expect(resolved!.resolved_by).toBe("agent-1");

    const openAfter = listConflicts({ status: "open" });
    expect(openAfter).toHaveLength(0);
  });
});

// ── Import / Export ────────────────────────────────────────────────

describe("import/export", () => {
  it("exports and reimports all data", () => {
    const contact = createEntity({ type: "contact", properties: { full_name: "Alice" } });
    const company = createEntity({ type: "company", properties: { name: "Acme" } });
    createRelationship({ from_id: contact.id, to_id: company.id, type: "EMPLOYED_AT" });
    const artifact = createArtifact({ artifact_type: "note", content: "Meeting notes" });
    const obs = createObservation({
      entity_id: contact.id,
      artifact_id: artifact.id,
      observation_type: "field_value",
      value: "CTO",
    });
    createBrief({
      entity_id: contact.id,
      brief_type: "contact_summary",
      content: "Alice is CTO",
      observation_ids: [obs.id],
    });
    createConflict({
      observation_ids: [obs.id, obs.id],
      entity_id: contact.id,
      description: "Test conflict",
    });

    const exported = exportAll();
    expect(exported.entities).toHaveLength(2);
    expect(exported.relationships).toHaveLength(1);
    expect(exported.artifacts).toHaveLength(1);
    expect(exported.observations).toHaveLength(1);
    expect(exported.briefs).toHaveLength(1);
    expect(exported.conflicts).toHaveLength(1);
    expect(exported.events.length).toBeGreaterThan(0);

    // Reimport into fresh db
    initDb(":memory:");
    const stats = importAll(exported);
    expect(stats.entities).toBe(2);
    expect(stats.relationships).toBe(1);
    expect(stats.artifacts).toBe(1);
    expect(stats.observations).toBe(1);
    expect(stats.briefs).toBe(1);
    expect(stats.conflicts).toBe(1);

    // Verify data survived
    const reimported = getEntity(contact.id);
    expect(reimported!.properties.full_name).toBe("Alice");
  });
});
