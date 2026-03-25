import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { ZodError, ZodSchema } from "zod";
import { config } from "./config.js";
import {
  archiveEntity,
  createEntity,
  createRelationship,
  deleteRelationship,
  getEntity,
  getDb,
  getIdempotentResponse,
  listEntityFieldProvenance,
  listEvents,
  listRelationships,
  searchEntities,
  countEntities,
  storeIdempotentResponse,
  traverseGraph,
  updateEntity,
  createArtifact,
  getArtifact,
  listArtifacts,
  countArtifacts,
  createObservation,
  getObservation,
  listObservations,
  countObservations,
  updateObservationLifecycle,
  createBrief,
  getBrief,
  listBriefs,
  countBriefs,
  createConflict,
  getConflict,
  listConflicts,
  countConflicts,
  resolveConflict,
  exportAll,
  importAll,
} from "./db.js";
import { getActorContext, parseIdempotency } from "./http.js";
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

// ── Helpers ────────────────────────────────────────────────────────

function validate<T>(schema: ZodSchema<T>, data: unknown): { data: T } | { error: string } {
  try {
    return { data: schema.parse(data) };
  } catch (err) {
    if (err instanceof ZodError) {
      const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
      return { error: messages.join("; ") };
    }
    return { error: "Validation failed" };
  }
}

function paginated<T>(items: T[], total: number, limit: number, offset: number) {
  return { items, total, limit, offset, has_more: offset + items.length < total };
}

// ── App setup ──────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();
  _res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(
      JSON.stringify({
        method: req.method,
        path: req.path,
        status: _res.statusCode,
        ms,
        ts: new Date().toISOString(),
      })
    );
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── Entities ───────────────────────────────────────────────────────

app.post("/entities", (req, res) => {
  const op = "POST /entities";
  const idempotencyKey = parseIdempotency(req);
  if (idempotencyKey) {
    const cached = getIdempotentResponse(op, idempotencyKey);
    if (cached) {
      return res.status(cached.status_code).json(cached.response);
    }
  }

  const parsed = validate(CreateEntitySchema, req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  try {
    const entity = createEntity(parsed.data, getActorContext(req));
    const response = { entity };
    if (idempotencyKey) {
      storeIdempotentResponse(op, idempotencyKey, 201, response);
    }
    return res.status(201).json(response);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "Invalid payload" });
  }
});

app.get("/entities/:id", (req, res) => {
  const entity = getEntity(req.params.id);
  if (!entity) return res.status(404).json({ error: "Not found" });

  const includeFieldProvenance = req.query.include_field_provenance === "true";
  const field_provenance = includeFieldProvenance
    ? listEntityFieldProvenance(entity.id)
    : undefined;

  return res.json({ entity, field_provenance });
});

app.patch("/entities/:id", (req, res) => {
  const op = "PATCH /entities/:id";
  const idempotencyKey = parseIdempotency(req);
  if (idempotencyKey) {
    const cached = getIdempotentResponse(op, idempotencyKey);
    if (cached) {
      return res.status(cached.status_code).json(cached.response);
    }
  }

  const parsed = validate(UpdateEntitySchema, req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  try {
    const updated = updateEntity(req.params.id, parsed.data, getActorContext(req));
    if (!updated) return res.status(404).json({ error: "Not found" });
    const response = { entity: updated };
    if (idempotencyKey) {
      storeIdempotentResponse(op, idempotencyKey, 200, response);
    }
    return res.json(response);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "Invalid payload" });
  }
});

app.delete("/entities/:id", (req, res) => {
  const op = "DELETE /entities/:id";
  const idempotencyKey = parseIdempotency(req);
  if (idempotencyKey) {
    const cached = getIdempotentResponse(op, idempotencyKey);
    if (cached) {
      return res.status(cached.status_code).json(cached.response);
    }
  }

  const archived = archiveEntity(req.params.id, getActorContext(req));
  if (!archived) return res.status(404).json({ error: "Not found" });

  const response = { entity: archived };
  if (idempotencyKey) {
    storeIdempotentResponse(op, idempotencyKey, 200, response);
  }

  return res.json(response);
});

// ── Relationships ──────────────────────────────────────────────────

app.post("/relationships", (req, res) => {
  const op = "POST /relationships";
  const idempotencyKey = parseIdempotency(req);
  if (idempotencyKey) {
    const cached = getIdempotentResponse(op, idempotencyKey);
    if (cached) {
      return res.status(cached.status_code).json(cached.response);
    }
  }

  const parsed = validate(CreateRelationshipSchema, req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  try {
    const relationship = createRelationship(parsed.data, getActorContext(req));
    const response = { relationship };
    if (idempotencyKey) {
      storeIdempotentResponse(op, idempotencyKey, 201, response);
    }
    return res.status(201).json(response);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "Invalid payload" });
  }
});

app.get("/relationships", (req, res) => {
  const entity_id = req.query.entity_id ? String(req.query.entity_id) : undefined;
  const type = req.query.type ? String(req.query.type) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const relationships = listRelationships({ entity_id, type, limit, offset });
  return res.json({ relationships });
});

app.delete("/relationships/:id", (req, res) => {
  const op = "DELETE /relationships/:id";
  const idempotencyKey = parseIdempotency(req);
  if (idempotencyKey) {
    const cached = getIdempotentResponse(op, idempotencyKey);
    if (cached) {
      return res.status(cached.status_code).json(cached.response);
    }
  }

  const ok = deleteRelationship(req.params.id, getActorContext(req));
  if (!ok) return res.status(404).json({ error: "Not found" });

  const response = { deleted: true };
  if (idempotencyKey) {
    storeIdempotentResponse(op, idempotencyKey, 200, response);
  }

  return res.json(response);
});

// ── Search / Graph / Events ────────────────────────────────────────

app.get("/search", (req, res) => {
  const raw: Record<string, unknown> = {};
  if (req.query.type) raw.type = String(req.query.type);
  if (req.query.q) raw.q = String(req.query.q);
  if (req.query.limit) raw.limit = Number(req.query.limit);
  if (req.query.offset) raw.offset = Number(req.query.offset);
  if (req.query.sort) raw.sort = String(req.query.sort);
  if (req.query.order) raw.order = String(req.query.order);
  if (req.query.filters) {
    try {
      raw.filters = JSON.parse(String(req.query.filters));
    } catch {
      return res.status(400).json({ error: "Invalid filters JSON" });
    }
  }

  const parsed = validate(SearchParamsSchema, raw);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  try {
    const results = searchEntities(parsed.data);
    const total = countEntities(parsed.data);
    const limit = Math.min(parsed.data.limit ?? 50, 200);
    const offset = parsed.data.offset ?? 0;
    return res.json(paginated(results, total, limit, offset));
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "Invalid query" });
  }
});

app.get("/graph", (req, res) => {
  const raw: Record<string, unknown> = {};
  if (req.query.entity_id) raw.entity_id = String(req.query.entity_id);
  if (req.query.direction) raw.direction = String(req.query.direction);
  if (req.query.type) raw.type = String(req.query.type);
  if (req.query.depth) raw.depth = Number(req.query.depth);
  if (req.query.limit) raw.limit = Number(req.query.limit);

  const parsed = validate(GraphQuerySchema, raw);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  try {
    const graph = traverseGraph(parsed.data);
    return res.json(graph);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "Invalid query" });
  }
});

app.get("/events", (req, res) => {
  const entity_id = req.query.entity_id ? String(req.query.entity_id) : null;
  if (!entity_id) return res.status(400).json({ error: "entity_id required" });

  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;

  const events = listEvents(entity_id, limit, offset);
  return res.json({ events });
});

// ── Artifacts ──────────────────────────────────────────────────────

app.post("/artifacts", (req, res) => {
  const parsed = validate(CreateArtifactSchema, req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  try {
    const artifact = createArtifact(parsed.data);
    return res.status(201).json({ artifact });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "Invalid payload" });
  }
});

app.get("/artifacts/:id", (req, res) => {
  const artifact = getArtifact(req.params.id);
  if (!artifact) return res.status(404).json({ error: "Not found" });
  return res.json({ artifact });
});

app.get("/artifacts", (req, res) => {
  const artifact_type = req.query.artifact_type ? String(req.query.artifact_type) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const artifacts = listArtifacts({ artifact_type, limit, offset });
  const total = countArtifacts({ artifact_type });
  return res.json(paginated(artifacts, total, limit, offset));
});

// ── Observations ───────────────────────────────────────────────────

app.post("/observations", (req, res) => {
  const parsed = validate(CreateObservationSchema, req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  try {
    const observation = createObservation(parsed.data as Parameters<typeof createObservation>[0]);
    return res.status(201).json({ observation });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "Invalid payload" });
  }
});

app.get("/observations/:id", (req, res) => {
  const observation = getObservation(req.params.id);
  if (!observation) return res.status(404).json({ error: "Not found" });
  return res.json({ observation });
});

app.get("/observations", (req, res) => {
  const entity_id = req.query.entity_id ? String(req.query.entity_id) : undefined;
  const artifact_id = req.query.artifact_id ? String(req.query.artifact_id) : undefined;
  const lifecycle = req.query.lifecycle ? String(req.query.lifecycle) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const observations = listObservations({ entity_id, artifact_id, lifecycle, limit, offset });
  const total = countObservations({ entity_id, artifact_id, lifecycle });
  return res.json(paginated(observations, total, limit, offset));
});

app.patch("/observations/:id/supersede", (req, res) => {
  const superseded_by = req.body.superseded_by;
  if (!superseded_by) return res.status(400).json({ error: "superseded_by required" });
  const observation = updateObservationLifecycle(req.params.id, "superseded", superseded_by);
  if (!observation) return res.status(404).json({ error: "Not found" });
  return res.json({ observation });
});

app.patch("/observations/:id/retract", (req, res) => {
  const observation = updateObservationLifecycle(req.params.id, "retracted");
  if (!observation) return res.status(404).json({ error: "Not found" });
  return res.json({ observation });
});

// ── Briefs ─────────────────────────────────────────────────────────

app.post("/briefs", (req, res) => {
  const parsed = validate(CreateBriefSchema, req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  try {
    const brief = createBrief(parsed.data);
    return res.status(201).json({ brief });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "Invalid payload" });
  }
});

app.get("/briefs/:id", (req, res) => {
  const brief = getBrief(req.params.id);
  if (!brief) return res.status(404).json({ error: "Not found" });
  return res.json({ brief });
});

app.get("/briefs", (req, res) => {
  const entity_id = req.query.entity_id ? String(req.query.entity_id) : undefined;
  const brief_type = req.query.brief_type ? String(req.query.brief_type) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const briefs = listBriefs({ entity_id, brief_type, limit, offset });
  const total = countBriefs({ entity_id, brief_type });
  return res.json(paginated(briefs, total, limit, offset));
});

// ── Conflicts ──────────────────────────────────────────────────────

app.post("/conflicts", (req, res) => {
  const parsed = validate(CreateConflictSchema, req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  try {
    const conflict = createConflict(parsed.data);
    return res.status(201).json({ conflict });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "Invalid payload" });
  }
});

app.get("/conflicts/:id", (req, res) => {
  const conflict = getConflict(req.params.id);
  if (!conflict) return res.status(404).json({ error: "Not found" });
  return res.json({ conflict });
});

app.get("/conflicts", (req, res) => {
  const entity_id = req.query.entity_id ? String(req.query.entity_id) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const conflicts = listConflicts({ entity_id, status, limit, offset });
  const total = countConflicts({ entity_id, status });
  return res.json(paginated(conflicts, total, limit, offset));
});

app.patch("/conflicts/:id/resolve", (req, res) => {
  const parsed = validate(ResolveConflictSchema, req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  const conflict = resolveConflict(req.params.id, parsed.data.resolution, parsed.data.resolved_by);
  if (!conflict) return res.status(404).json({ error: "Not found" });
  return res.json({ conflict });
});

// ── Import / Export ────────────────────────────────────────────────

app.get("/export", (_req, res) => {
  try {
    const data = exportAll();
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Export failed" });
  }
});

app.post("/import", (req, res) => {
  try {
    const stats = importAll(req.body);
    return res.json({ success: true, stats });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? "Import failed" });
  }
});

// ── Error handler ──────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack, ts: new Date().toISOString() }));
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ──────────────────────────────────────────────────────────

let server: ReturnType<typeof app.listen> | null = null;

const isDirectRun = process.argv[1]?.includes("server");
if (isDirectRun) {
  server = app.listen(config.port, () => {
    console.log(`Open Tooling CRM REST API listening on ${config.port}`);
  });

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      console.log(`Received ${signal}, shutting down...`);
      server?.close(() => {
        try {
          getDb().close();
        } catch { /* already closed */ }
        console.log("Server stopped.");
        process.exit(0);
      });
    });
  }
}

export { app };
