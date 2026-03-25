import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ZodError, ZodSchema } from "zod";
import {
  archiveEntity,
  createEntity,
  createRelationship,
  deleteRelationship,
  listRelationships,
  getEntity,
  listEntityFieldProvenance,
  listEvents,
  searchEntities,
  traverseGraph,
  updateEntity,
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
} from "./db.js";
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
} from "./schemas.js";

function validateArgs<T>(schema: ZodSchema<T>, args: unknown): T {
  try {
    return schema.parse(args);
  } catch (err) {
    if (err instanceof ZodError) {
      const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
      throw new Error(`Validation error: ${messages.join("; ")}`);
    }
    throw err;
  }
}

const server = new Server(
  {
    name: "open-tooling-crm",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const tools = [
  // ── Entity tools ─────────────────────────────────────────────────
  {
    name: "create_entity",
    description:
      "Create a CRM entity (contact, company, deal, interaction, task, or agent). " +
      "Provide a type and optional properties, summary, confidence, verification status, and provenance. " +
      "Returns the created entity with its generated id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["contact", "company", "deal", "interaction", "task", "agent"],
          description: "The entity type",
        },
        properties: {
          type: "object",
          description:
            "Type-specific fields. Contact: full_name, email, phone, title, location, linkedin_url, notes. " +
            "Company: name, domain, industry, size, location, notes. " +
            "Deal: name, value, currency, stage, close_date, notes. " +
            "Interaction: type (email/call/meeting/note), timestamp, participants, content, outcome. " +
            "Task: title, status (todo/doing/done), priority (low/medium/high), due_date, assignee, notes. " +
            "Agent: name, agent_type (system/human/model), capabilities, trust_tier (low/medium/high), notes.",
        },
        summary: { type: "string", description: "Short agent-written summary of this entity" },
        confidence: { type: "number", description: "Confidence score 0.0-1.0" },
        verification: {
          type: "string",
          enum: ["unverified", "verified", "low_confidence"],
          description: "Verification status",
        },
        provenance: {
          type: "object",
          description: "Source metadata: source_agent, tool_call_id, prompt_hash, timestamp, confidence, verification",
        },
        status: { type: "string", enum: ["active", "archived"] },
        field_provenance: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field_path: { type: "string", description: "Dot-path to the field, e.g. 'properties.email'" },
              provenance: { type: "object" },
            },
          },
          description: "Per-field provenance overrides",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "update_entity",
    description:
      "Update an existing CRM entity by id. " +
      "Properties are merged by default (set replace_properties=true to overwrite). " +
      "Returns the updated entity.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Entity id to update" },
        properties: { type: "object", description: "Fields to merge (or replace) into properties" },
        replace_properties: { type: "boolean", description: "If true, fully replace properties instead of merging" },
        summary: { type: "string" },
        confidence: { type: "number" },
        verification: { type: "string", enum: ["unverified", "verified", "low_confidence"] },
        provenance: { type: "object" },
        status: { type: "string", enum: ["active", "archived"] },
        field_provenance: {
          type: "array",
          items: { type: "object", properties: { field_path: { type: "string" }, provenance: { type: "object" } } },
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_entity",
    description:
      "Fetch a CRM entity by id. Optionally include field-level provenance. " +
      "Returns the entity and its field provenance if requested.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Entity id" },
        include_field_provenance: { type: "boolean", description: "Include per-field provenance data" },
      },
      required: ["id"],
    },
  },
  {
    name: "search_entities",
    description:
      "Search CRM entities using structured filters, full-text search, or both. " +
      "Filter by type, use 'q' for keyword search, and 'filters' for field-level conditions. " +
      "Filters support operators: =, !=, >, >=, <, <=, LIKE. " +
      "Filter on base fields (type, status, confidence, etc.) or properties via 'properties.field_name'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["contact", "company", "deal", "interaction", "task", "agent"] },
        q: { type: "string", description: "Full-text search query" },
        filters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string", description: "Field to filter on, e.g. 'status' or 'properties.email'" },
              op: { type: "string", enum: ["=", "!=", ">", ">=", "<", "<=", "LIKE"] },
              value: { description: "Value to compare against" },
            },
            required: ["field", "op", "value"],
          },
        },
        limit: { type: "number", description: "Max results (1-200, default 50)" },
        offset: { type: "number", description: "Pagination offset" },
        sort: { type: "string", description: "Field to sort by" },
        order: { type: "string", enum: ["asc", "desc"] },
      },
    },
  },
  {
    name: "link_entities",
    description:
      "Create a typed relationship between two entities. " +
      "Relationship types: EMPLOYED_AT (contact→company), ASSOCIATED_WITH (contact→deal), " +
      "OWNS (company→deal), INTERACTED_WITH (interaction→entity), CREATED_BY (entity→agent), RELATED_TO (any↔any).",
    inputSchema: {
      type: "object" as const,
      properties: {
        from_id: { type: "string", description: "Source entity id" },
        to_id: { type: "string", description: "Target entity id" },
        type: {
          type: "string",
          enum: ["EMPLOYED_AT", "ASSOCIATED_WITH", "OWNS", "INTERACTED_WITH", "CREATED_BY", "RELATED_TO"],
          description: "Relationship type",
        },
        metadata: { type: "object", description: "Optional metadata for the relationship" },
        confidence: { type: "number" },
        verification: { type: "string", enum: ["unverified", "verified", "low_confidence"] },
      },
      required: ["from_id", "to_id", "type"],
    },
  },
  {
    name: "unlink_entities",
    description: "Delete a relationship by its id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Relationship id to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_relationships",
    description:
      "List relationships for a given entity. Returns all relationships where the entity is either the source or target. " +
      "Simpler than traverse_graph — use this when you just need to see an entity's direct connections.",
    inputSchema: {
      type: "object" as const,
      properties: {
        entity_id: { type: "string", description: "Entity id to list relationships for" },
        type: { type: "string", description: "Filter by relationship type" },
        limit: { type: "number", description: "Max results (default: 50)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "traverse_graph",
    description:
      "Traverse entity relationships starting from a given entity. " +
      "Returns connected nodes and edges up to the specified depth (max 3). " +
      "Use direction to control traversal: 'out' (from→to), 'in' (to→from), or 'both'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        entity_id: { type: "string", description: "Starting entity id" },
        direction: { type: "string", enum: ["out", "in", "both"], description: "Traversal direction (default: both)" },
        type: { type: "string", description: "Filter by relationship type" },
        depth: { type: "number", description: "Traversal depth 1-3 (default: 1)" },
        limit: { type: "number", description: "Max edges to return (default: 100, max: 500)" },
      },
      required: ["entity_id"],
    },
  },
  {
    name: "get_entity_history",
    description:
      "Get the event ledger for an entity showing all mutations (create, update, delete, merge). " +
      "Each event includes the diff, actor, timestamp, and tool_call_id for full auditability.",
    inputSchema: {
      type: "object" as const,
      properties: {
        entity_id: { type: "string", description: "Entity id to get history for" },
        limit: { type: "number", description: "Max events (default: 50)" },
        offset: { type: "number", description: "Pagination offset" },
      },
      required: ["entity_id"],
    },
  },
  {
    name: "archive_entity",
    description: "Soft-delete (archive) an entity. Sets status to 'archived'. Reversible via update_entity.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Entity id to archive" },
      },
      required: ["id"],
    },
  },
  // ── Memory: Artifacts ────────────────────────────────────────────
  {
    name: "ingest_artifact",
    description:
      "Ingest a raw evidence artifact (email, call transcript, meeting notes, document, or note). " +
      "Artifacts are immutable records that serve as sources of truth. " +
      "After ingesting, use add_observation to extract claims from the artifact.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artifact_type: {
          type: "string",
          enum: ["email", "call_transcript", "meeting_notes", "document", "note"],
          description: "Type of artifact",
        },
        title: { type: "string", description: "Title or subject line" },
        content: { type: "string", description: "Full content of the artifact" },
        participants: {
          type: "array",
          items: { type: "string" },
          description: "Entity ids of participants",
        },
        source_url: { type: "string", description: "Source URL if applicable" },
        recorded_at: { type: "string", description: "ISO-8601 timestamp of when the artifact originally occurred" },
        metadata: { type: "object", description: "Additional metadata" },
      },
      required: ["artifact_type", "content"],
    },
  },
  {
    name: "get_artifact",
    description: "Fetch an artifact by id. Returns the full artifact including content and metadata.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Artifact id" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_artifacts",
    description: "List artifacts, optionally filtered by type.",
    inputSchema: {
      type: "object" as const,
      properties: {
        artifact_type: {
          type: "string",
          enum: ["email", "call_transcript", "meeting_notes", "document", "note"],
        },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  // ── Memory: Observations ─────────────────────────────────────────
  {
    name: "add_observation",
    description:
      "Record an atomic, typed claim extracted from evidence. " +
      "Observations are the building blocks of CRM knowledge. " +
      "Each observation should reference an artifact_id for traceability. " +
      "Examples: 'Deal budget is $120k', 'Decision maker is Maya Chen', 'Next step: send pricing'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        entity_id: { type: "string", description: "Entity this observation is about" },
        artifact_id: { type: "string", description: "Source artifact id (for evidence chain)" },
        observation_type: {
          type: "string",
          description: "Type of claim: field_value, status_change, sentiment, next_step, decision, requirement, risk, etc.",
        },
        field_path: { type: "string", description: "Entity field this observation is about, e.g. 'properties.email'" },
        value: { description: "The actual claim value (string, number, object, etc.)" },
        snippet: { type: "string", description: "Relevant excerpt from the source artifact" },
        confidence: { type: "number", description: "Confidence score 0.0-1.0" },
        verification: { type: "string", enum: ["unverified", "verified", "low_confidence"] },
        as_of: { type: "string", description: "ISO-8601 timestamp of when this fact was true" },
        valid_until: { type: "string", description: "ISO-8601 timestamp of when this fact expires" },
        actor: { type: "string", description: "Agent or user who made this observation" },
      },
      required: ["entity_id", "observation_type", "value"],
    },
  },
  {
    name: "get_observation",
    description: "Fetch an observation by id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Observation id" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_observations",
    description:
      "List observations for an entity, artifact, or lifecycle state. " +
      "Use lifecycle='current' to get active facts only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        entity_id: { type: "string", description: "Filter by entity" },
        artifact_id: { type: "string", description: "Filter by source artifact" },
        lifecycle: { type: "string", enum: ["current", "superseded", "retracted"], description: "Filter by lifecycle state" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "supersede_observation",
    description:
      "Mark an observation as superseded by a newer one. " +
      "Use when new information replaces old (e.g., updated deal value). " +
      "The old observation is preserved for history but marked as superseded.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Observation id to supersede" },
        superseded_by: { type: "string", description: "Id of the newer observation that replaces this one" },
      },
      required: ["id", "superseded_by"],
    },
  },
  {
    name: "retract_observation",
    description: "Retract an observation that was found to be incorrect. Preserved for audit but marked as retracted.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Observation id to retract" },
      },
      required: ["id"],
    },
  },
  // ── Memory: Briefs ───────────────────────────────────────────────
  {
    name: "create_brief",
    description:
      "Create a derived summary (brief) for an entity that cites specific observations. " +
      "Briefs are regeneratable and not authoritative — they summarize current observations. " +
      "Always include observation_ids to maintain the evidence chain.",
    inputSchema: {
      type: "object" as const,
      properties: {
        entity_id: { type: "string", description: "Entity this brief summarizes" },
        brief_type: {
          type: "string",
          description: "Brief type: contact_summary, deal_summary, account_summary, interaction_digest, etc.",
        },
        content: { type: "string", description: "The summary text, citing observation ids where appropriate" },
        observation_ids: {
          type: "array",
          items: { type: "string" },
          description: "Observation ids cited in this brief",
        },
        policy_version: { type: "string", description: "Version of the policy used to generate this brief" },
        generated_by: { type: "string", description: "Agent/model that generated this brief" },
      },
      required: ["entity_id", "brief_type", "content", "observation_ids"],
    },
  },
  {
    name: "get_brief",
    description: "Fetch a brief by id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Brief id" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_briefs",
    description: "List briefs for an entity, optionally filtered by brief type.",
    inputSchema: {
      type: "object" as const,
      properties: {
        entity_id: { type: "string", description: "Filter by entity" },
        brief_type: { type: "string", description: "Filter by brief type" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  // ── Memory: Conflicts ────────────────────────────────────────────
  {
    name: "create_conflict",
    description:
      "Record a conflict when two or more observations cannot both be true. " +
      "Conflicts should never be silently resolved — they create an explicit record. " +
      "Example: two different values observed for a deal's budget from different sources.",
    inputSchema: {
      type: "object" as const,
      properties: {
        observation_ids: {
          type: "array",
          items: { type: "string" },
          description: "Ids of the conflicting observations (minimum 2)",
        },
        entity_id: { type: "string", description: "Entity the conflict is about" },
        field_path: { type: "string", description: "Field that has conflicting values" },
        description: { type: "string", description: "Human-readable description of the conflict" },
      },
      required: ["observation_ids", "entity_id", "description"],
    },
  },
  {
    name: "get_conflict",
    description: "Fetch a conflict by id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Conflict id" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_conflicts",
    description: "List conflicts, optionally filtered by entity or status (open/resolved).",
    inputSchema: {
      type: "object" as const,
      properties: {
        entity_id: { type: "string", description: "Filter by entity" },
        status: { type: "string", enum: ["open", "resolved"], description: "Filter by status" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "resolve_conflict",
    description: "Resolve a conflict by providing a resolution explanation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Conflict id to resolve" },
        resolution: { type: "string", description: "Explanation of how the conflict was resolved" },
        resolved_by: { type: "string", description: "Agent or user who resolved the conflict" },
      },
      required: ["id", "resolution"],
    },
  },
  // ── Import / Export ──────────────────────────────────────────────
  {
    name: "export_data",
    description: "Export all CRM data as a JSON object. Includes entities, relationships, events, artifacts, observations, briefs, and conflicts.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "import_data",
    description: "Import CRM data from a JSON object. Uses INSERT OR REPLACE so existing records are updated. Returns counts of imported records.",
    inputSchema: {
      type: "object" as const,
      properties: {
        entities: { type: "array" },
        relationships: { type: "array" },
        events: { type: "array" },
        field_provenance: { type: "array" },
        artifacts: { type: "array" },
        observations: { type: "array" },
        briefs: { type: "array" },
        conflicts: { type: "array" },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_entity": {
        const input = validateArgs(CreateEntitySchema, args);
        const entity = createEntity(input);
        return jsonResult({ entity });
      }
      case "update_entity": {
        const { id, ...patch } = args as any;
        if (!id) return jsonResult({ error: "id is required" }, true);
        const validated = validateArgs(UpdateEntitySchema, patch);
        const entity = updateEntity(id, validated);
        if (!entity) return jsonResult({ error: "Not found" }, true);
        return jsonResult({ entity });
      }
      case "get_entity": {
        const { id, include_field_provenance } = args as any;
        if (!id) return jsonResult({ error: "id is required" }, true);
        const entity = getEntity(id);
        if (!entity) return jsonResult({ error: "Not found" }, true);
        const field_provenance = include_field_provenance
          ? listEntityFieldProvenance(id)
          : undefined;
        return jsonResult({ entity, field_provenance });
      }
      case "search_entities": {
        const params = validateArgs(SearchParamsSchema, args);
        const results = searchEntities(params);
        return jsonResult({ results });
      }
      case "link_entities": {
        const input = validateArgs(CreateRelationshipSchema, args);
        const relationship = createRelationship(input);
        return jsonResult({ relationship });
      }
      case "unlink_entities": {
        const { id } = args as any;
        if (!id) return jsonResult({ error: "id is required" }, true);
        const ok = deleteRelationship(id);
        if (!ok) return jsonResult({ error: "Not found" }, true);
        return jsonResult({ deleted: true });
      }
      case "list_relationships": {
        const relationships = listRelationships({
          entity_id: (args as any)?.entity_id,
          type: (args as any)?.type,
          limit: (args as any)?.limit,
          offset: (args as any)?.offset,
        });
        return jsonResult({ relationships });
      }
      case "traverse_graph": {
        const query = validateArgs(GraphQuerySchema, args);
        const graph = traverseGraph(query);
        return jsonResult(graph);
      }
      case "get_entity_history": {
        const { entity_id, limit, offset } = args as any;
        if (!entity_id) return jsonResult({ error: "entity_id is required" }, true);
        const events = listEvents(entity_id, limit ?? 50, offset ?? 0);
        return jsonResult({ events });
      }
      case "archive_entity": {
        const { id } = args as any;
        if (!id) return jsonResult({ error: "id is required" }, true);
        const entity = archiveEntity(id);
        if (!entity) return jsonResult({ error: "Not found" }, true);
        return jsonResult({ entity });
      }
      // ── Artifacts ────────────────────────────────────────────────
      case "ingest_artifact": {
        const input = validateArgs(CreateArtifactSchema, args);
        const artifact = createArtifact(input);
        return jsonResult({ artifact });
      }
      case "get_artifact": {
        const { id } = args as any;
        if (!id) return jsonResult({ error: "id is required" }, true);
        const artifact = getArtifact(id);
        if (!artifact) return jsonResult({ error: "Not found" }, true);
        return jsonResult({ artifact });
      }
      case "list_artifacts": {
        const artifacts = listArtifacts({
          artifact_type: (args as any)?.artifact_type,
          limit: (args as any)?.limit,
          offset: (args as any)?.offset,
        });
        return jsonResult({ artifacts });
      }
      // ── Observations ─────────────────────────────────────────────
      case "add_observation": {
        const input = validateArgs(CreateObservationSchema, args);
        const observation = createObservation(input as Parameters<typeof createObservation>[0]);
        return jsonResult({ observation });
      }
      case "get_observation": {
        const { id } = args as any;
        if (!id) return jsonResult({ error: "id is required" }, true);
        const observation = getObservation(id);
        if (!observation) return jsonResult({ error: "Not found" }, true);
        return jsonResult({ observation });
      }
      case "list_observations": {
        const observations = listObservations({
          entity_id: (args as any)?.entity_id,
          artifact_id: (args as any)?.artifact_id,
          lifecycle: (args as any)?.lifecycle,
          limit: (args as any)?.limit,
          offset: (args as any)?.offset,
        });
        return jsonResult({ observations });
      }
      case "supersede_observation": {
        const { id, superseded_by } = args as any;
        if (!id || !superseded_by) return jsonResult({ error: "id and superseded_by are required" }, true);
        const observation = updateObservationLifecycle(id, "superseded", superseded_by);
        if (!observation) return jsonResult({ error: "Not found" }, true);
        return jsonResult({ observation });
      }
      case "retract_observation": {
        const { id } = args as any;
        if (!id) return jsonResult({ error: "id is required" }, true);
        const observation = updateObservationLifecycle(id, "retracted");
        if (!observation) return jsonResult({ error: "Not found" }, true);
        return jsonResult({ observation });
      }
      // ── Briefs ───────────────────────────────────────────────────
      case "create_brief": {
        const input = validateArgs(CreateBriefSchema, args);
        const brief = createBrief(input);
        return jsonResult({ brief });
      }
      case "get_brief": {
        const { id } = args as any;
        if (!id) return jsonResult({ error: "id is required" }, true);
        const brief = getBrief(id);
        if (!brief) return jsonResult({ error: "Not found" }, true);
        return jsonResult({ brief });
      }
      case "list_briefs": {
        const briefs = listBriefs({
          entity_id: (args as any)?.entity_id,
          brief_type: (args as any)?.brief_type,
          limit: (args as any)?.limit,
          offset: (args as any)?.offset,
        });
        return jsonResult({ briefs });
      }
      // ── Conflicts ────────────────────────────────────────────────
      case "create_conflict": {
        const input = validateArgs(CreateConflictSchema, args);
        const conflict = createConflict(input);
        return jsonResult({ conflict });
      }
      case "get_conflict": {
        const { id } = args as any;
        if (!id) return jsonResult({ error: "id is required" }, true);
        const conflict = getConflict(id);
        if (!conflict) return jsonResult({ error: "Not found" }, true);
        return jsonResult({ conflict });
      }
      case "list_conflicts": {
        const conflicts = listConflicts({
          entity_id: (args as any)?.entity_id,
          status: (args as any)?.status,
          limit: (args as any)?.limit,
          offset: (args as any)?.offset,
        });
        return jsonResult({ conflicts });
      }
      case "resolve_conflict": {
        const { id } = args as any;
        if (!id) return jsonResult({ error: "id is required" }, true);
        const input = validateArgs(ResolveConflictSchema, { resolution: (args as any)?.resolution, resolved_by: (args as any)?.resolved_by });
        const conflict = resolveConflict(id, input.resolution, input.resolved_by);
        if (!conflict) return jsonResult({ error: "Not found" }, true);
        return jsonResult({ conflict });
      }
      // ── Import / Export ──────────────────────────────────────────
      case "export_data": {
        const data = exportAll();
        return jsonResult(data);
      }
      case "import_data": {
        const stats = importAll(args as any);
        return jsonResult({ success: true, stats });
      }
      default:
        return jsonResult({ error: `Unknown tool: ${name}` }, true);
    }
  } catch (err: any) {
    return jsonResult({ error: err?.message ?? "Tool error" }, true);
  }
});

function jsonResult(payload: unknown, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    isError,
  };
}

const transport = new StdioServerTransport();
server.connect(transport);
