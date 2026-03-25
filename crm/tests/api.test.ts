import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { initDb } from "../src/db.js";

// Must init db before importing server (which triggers db init)
beforeEach(() => {
  initDb(":memory:");
});

// Dynamic import to get fresh app after db init
async function getApp() {
  // Re-import to pick up the in-memory db
  const { app } = await import("../src/server.js");
  return app;
}

describe("REST API", () => {
  describe("health", () => {
    it("GET /health returns ok", async () => {
      const app = await getApp();
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("entities", () => {
    it("POST /entities creates an entity", async () => {
      const app = await getApp();
      const res = await request(app)
        .post("/entities")
        .send({ type: "contact", properties: { full_name: "Alice" } });

      expect(res.status).toBe(201);
      expect(res.body.entity.type).toBe("contact");
      expect(res.body.entity.properties.full_name).toBe("Alice");
    });

    it("POST /entities validates input", async () => {
      const app = await getApp();
      const res = await request(app)
        .post("/entities")
        .send({ type: "invalid_type" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it("GET /entities/:id returns an entity", async () => {
      const app = await getApp();
      const created = await request(app)
        .post("/entities")
        .send({ type: "company", properties: { name: "Acme" } });

      const res = await request(app).get(`/entities/${created.body.entity.id}`);
      expect(res.status).toBe(200);
      expect(res.body.entity.properties.name).toBe("Acme");
    });

    it("GET /entities/:id returns 404 for missing", async () => {
      const app = await getApp();
      const res = await request(app).get("/entities/nonexistent");
      expect(res.status).toBe(404);
    });

    it("PATCH /entities/:id updates an entity", async () => {
      const app = await getApp();
      const created = await request(app)
        .post("/entities")
        .send({ type: "deal", properties: { name: "Big Deal" } });

      const res = await request(app)
        .patch(`/entities/${created.body.entity.id}`)
        .send({ properties: { stage: "negotiation" } });

      expect(res.status).toBe(200);
      expect(res.body.entity.properties.name).toBe("Big Deal");
      expect(res.body.entity.properties.stage).toBe("negotiation");
    });

    it("DELETE /entities/:id archives an entity", async () => {
      const app = await getApp();
      const created = await request(app)
        .post("/entities")
        .send({ type: "contact" });

      const res = await request(app).delete(`/entities/${created.body.entity.id}`);
      expect(res.status).toBe(200);
      expect(res.body.entity.status).toBe("archived");
    });
  });

  describe("relationships", () => {
    it("creates and deletes a relationship", async () => {
      const app = await getApp();
      const c = await request(app).post("/entities").send({ type: "contact" });
      const co = await request(app).post("/entities").send({ type: "company" });

      const res = await request(app).post("/relationships").send({
        from_id: c.body.entity.id,
        to_id: co.body.entity.id,
        type: "EMPLOYED_AT",
      });

      expect(res.status).toBe(201);
      expect(res.body.relationship.type).toBe("EMPLOYED_AT");

      const del = await request(app).delete(`/relationships/${res.body.relationship.id}`);
      expect(del.status).toBe(200);
      expect(del.body.deleted).toBe(true);
    });

    it("validates relationship type", async () => {
      const app = await getApp();
      const res = await request(app).post("/relationships").send({
        from_id: "a",
        to_id: "b",
        type: "INVALID_TYPE",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("search", () => {
    it("searches entities", async () => {
      const app = await getApp();
      await request(app).post("/entities").send({ type: "contact", properties: { full_name: "Alice" } });
      await request(app).post("/entities").send({ type: "company", properties: { name: "Acme" } });

      const res = await request(app).get("/search?type=contact");
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.has_more).toBe(false);
    });
  });

  describe("artifacts", () => {
    it("creates and retrieves an artifact", async () => {
      const app = await getApp();
      const res = await request(app).post("/artifacts").send({
        artifact_type: "email",
        content: "Meeting confirmed for Thursday",
        title: "Re: Meeting",
      });

      expect(res.status).toBe(201);
      expect(res.body.artifact.artifact_type).toBe("email");

      const get = await request(app).get(`/artifacts/${res.body.artifact.id}`);
      expect(get.status).toBe(200);
      expect(get.body.artifact.content).toBe("Meeting confirmed for Thursday");
    });

    it("validates artifact input", async () => {
      const app = await getApp();
      const res = await request(app).post("/artifacts").send({
        artifact_type: "invalid",
        content: "test",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("observations", () => {
    it("full lifecycle: create, supersede, retract", async () => {
      const app = await getApp();
      const entity = await request(app).post("/entities").send({ type: "deal" });
      const eid = entity.body.entity.id;

      const obs1 = await request(app).post("/observations").send({
        entity_id: eid,
        observation_type: "field_value",
        value: 100000,
      });
      expect(obs1.status).toBe(201);

      const obs2 = await request(app).post("/observations").send({
        entity_id: eid,
        observation_type: "field_value",
        value: 150000,
      });

      // Supersede obs1
      const sup = await request(app)
        .patch(`/observations/${obs1.body.observation.id}/supersede`)
        .send({ superseded_by: obs2.body.observation.id });
      expect(sup.status).toBe(200);
      expect(sup.body.observation.lifecycle).toBe("superseded");

      // Retract obs2
      const ret = await request(app)
        .patch(`/observations/${obs2.body.observation.id}/retract`);
      expect(ret.status).toBe(200);
      expect(ret.body.observation.lifecycle).toBe("retracted");
    });
  });

  describe("briefs", () => {
    it("creates and lists briefs", async () => {
      const app = await getApp();
      const entity = await request(app).post("/entities").send({ type: "contact" });
      const eid = entity.body.entity.id;

      const res = await request(app).post("/briefs").send({
        entity_id: eid,
        brief_type: "contact_summary",
        content: "Test brief content",
        observation_ids: [],
      });
      expect(res.status).toBe(201);

      const list = await request(app).get(`/briefs?entity_id=${eid}`);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.total).toBe(1);
    });
  });

  describe("conflicts", () => {
    it("creates and resolves a conflict", async () => {
      const app = await getApp();
      const entity = await request(app).post("/entities").send({ type: "deal" });
      const eid = entity.body.entity.id;

      const res = await request(app).post("/conflicts").send({
        observation_ids: ["obs-1", "obs-2"],
        entity_id: eid,
        description: "Conflicting deal values",
      });
      expect(res.status).toBe(201);
      expect(res.body.conflict.status).toBe("open");

      const resolve = await request(app)
        .patch(`/conflicts/${res.body.conflict.id}/resolve`)
        .send({ resolution: "Confirmed higher value" });
      expect(resolve.status).toBe(200);
      expect(resolve.body.conflict.status).toBe("resolved");
    });
  });

  describe("import/export", () => {
    it("exports and reimports data", async () => {
      const app = await getApp();
      await request(app).post("/entities").send({ type: "contact", properties: { full_name: "Alice" } });

      const exported = await request(app).get("/export");
      expect(exported.status).toBe(200);
      expect(exported.body.entities).toHaveLength(1);

      // Reimport
      initDb(":memory:");
      const imported = await request(app).post("/import").send(exported.body);
      expect(imported.status).toBe(200);
      expect(imported.body.stats.entities).toBe(1);
    });
  });
});
