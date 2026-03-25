# Open Tooling CRM Vision + High-Level Architecture

## Vision
Open Tooling CRM is an open-source, local-first, headless CRM framework designed for AI agents as the primary users. It is fully agnostic — not tied to any specific LLM, agent framework, or frontend — so you can build on top of it and configure it to your exact workflow.

Open Tooling CRM is not a "chatbot CRM". It is a system-of-record and retrieval substrate that lets agents:
1. Store canonical CRM objects (contacts, companies, deals, interactions, tasks).
2. Preserve evidence and provenance for every important claim, and retrieve facts deterministically (optional semantic search is on the roadmap).
3. Take action — ingesting evidence from emails and documents, extracting structured data, connecting to external systems. Agents are not just a query layer; they are operators.

## Who This Is For
1. Agent builders who need a reliable, configurable CRM substrate for autonomous workflows.
2. Teams that want local control of CRM data while giving agents safe, typed access.
3. Organizations looking to replace expensive per-seat CRM platforms with a self-hosted, AI-native alternative configured to their specific domain.

## Design Principles
1. Agents are the UI. They don't just retrieve data; they ingest evidence, extract facts, and take action.
2. Local-first. No required cloud dependencies, and for organizations that need shared access across teams, Open Tooling CRM is self-hostable on your own infrastructure (GCP, AWS, etc.) at a fraction of per-seat SaaS costs.
3. Vendor-neutral. Open Tooling CRM should not require a specific LLM provider.

## Configure It To Your Workflow

Open Tooling CRM is a universal foundation, not a finished product. You take the core package and configure it for your specific domain: define your entity types and properties, wire up your integrations, and deploy.

E.g. a masonry contractor tracks projects, bids, and superintendents instead of contacts and deals. A SaaS company tracks accounts, ARR, and renewal dates. A recruiting firm tracks candidates, roles, and placements. The data model is the same — typed entities with JSON properties, relationships, and an evidence layer — but the configuration is entirely yours.

## Intentionally Headless — Bring Your Own UI

Open Tooling CRM ships with no frontend. This is a deliberate architectural choice, not a missing feature.

Traditional CRMs couple their data layer to a rigid, opinionated UI. When that UI doesn't fit your workflow, you're stuck customizing within the vendor's constraints. Open Tooling CRM inverts this: the data layer and agent tooling are the product. The interface is whatever you want it to be.

With Open Tooling CRM the interface is easily malleable through conversation. Ask the agent to redesign a list view as a kanban board, add a new report, or surface a different metric — the app adapts to your organization's changing needs without developer intervention.

### Why Decoupled UI Matters
1. **Every team's workflow is different.** A sales team tracking enterprise deals needs a different interface than a founder managing inbound leads. Forcing one UI on both means neither is well-served.
2. **AI can generate UIs now.** Tools like Claude, ChatGPT, Cursor, Bolt, Lovable, and v0 can scaffold a full frontend from a natural language description in minutes. The bottleneck is no longer building the UI — it's having a solid, well-documented API behind it.
3. **Agents don't need UIs.** For pure agent workflows (the primary use case), the REST API and MCP tools are the interface. A human-facing UI is only needed for oversight and manual overrides.

### How to Build Your Own Frontend
Open Tooling CRM exposes everything through two clean interfaces — use whichever fits your stack:

1. **REST API (29 endpoints)** — Standard HTTP/JSON. Connect any frontend framework: React, Next.js, Vue, Svelte, a mobile app, or even a spreadsheet via API calls. All endpoints are documented with consistent pagination, filtering, and error handling.

2. **MCP Server (27 tools)** — For conversational interfaces. Connect to Claude Desktop, Claude Code, or any MCP-compatible client. The agent becomes the UI — users interact with their CRM data through natural language.

### Getting Started with a Custom UI
The fastest path to a working frontend:

1. **Vibe-code it.** Describe what you want to an AI coding tool (Claude, ChatGPT, Cursor, etc.): *"Build me a React dashboard that shows my deals pipeline using the Open Tooling CRM REST API at localhost:8787. Include a kanban board for deal stages, a contacts list with search, and a timeline of recent interactions."* The API is conventional enough that any code-generation tool can work with it.

2. **Start from the seed data.** Run `npm run seed` to populate with sample data, then point your UI at the API. You'll have realistic entities, relationships, and memory layer data to build against immediately.

3. **Use the MCP tools for a conversational UI.** If you'd rather interact through chat than clicks, connect Open Tooling CRM's MCP server to Claude Desktop. You get a full CRM interface through natural language — no frontend code needed.

## Part of Open Tooling

Open Tooling CRM is the first module in the **Open Tooling** family — a growing suite of open-source, AI-native SaaS tools that share the same architectural DNA: headless, local-first, evidence-based, and designed for agents as the primary interface.

CRM is the starting point because it touches every business. But the same patterns — typed entities, structured memory, MCP tooling, workflow-specific configurability — apply across the enterprise stack. Future modules will cover verticals like HR, Finance, Project Management, and Procurement, with more to follow.

Each module is standalone — you can use CRM without any of the others. But together they form an integrated, agent-operated back office where data flows across modules with full provenance and no vendor lock-in.

Explore the full family at [github.com/Attri-Inc/open-tooling](https://github.com/Attri-Inc/open-tooling).

## Non-Goals (Initial OSS Release)
1. Hosted sync or multi-tenant SaaS.
2. Email/calendar ingestion and enrichment connectors (provide extension points instead).
3. Bundled end-user UI (see "Intentionally Headless" above — build your own or use the MCP conversational interface).
4. "Vector-only" memory or opaque summaries that cannot be audited.
5. Existing CRM integrations (Salesforce, Zoho, HubSpot) — on the roadmap for organizations that want Open Tooling CRM's AI-native configurability layered on top of their current platform.

---

## High-Level Architecture

```mermaid
flowchart LR
  A[Agent Client (Claude / other)] -->|MCP tools| M[MCP Server]
  A -->|REST| R[REST API Server]

  M --> S[Open Tooling CRM Core Service]
  R --> S

  S --> DB[(SQLite)]
  DB --> E[Entities]
  DB --> L[Relationships]
  DB --> EV[Event Ledger]
  DB --> FTS[FTS Index]
  DB --> AR[Artifacts]
  DB --> OB[Observations]
  DB --> BR[Briefs]
  DB --> CF[Conflicts]
```

Both the REST API and MCP server call the same core. The data model is typed entities with JSON properties, directed relationships, an append-only event ledger, field-level provenance, and a memory layer (artifacts → observations → briefs → conflicts).

---

## Evidence-First Memory

Open Tooling CRM's memory layer is not generic notes. It is a structured evidence chain designed for CRM:

1. **Artifacts** — Raw, immutable evidence (emails, transcripts, meeting notes, documents). Content-hashed for integrity.
2. **Observations** — Typed claims extracted from artifacts, with lifecycle management (`current` → `superseded` / `retracted`). Every claim links back to its source.
3. **Briefs** — Derived summaries that cite observations. Always regeneratable — never authoritative.
4. **Conflicts** — Explicit records when observations disagree. Never silently resolved.

The progressive retrieval pattern — brief → observations → artifacts — lets agents start with a summary and drill down to raw evidence when needed. This is how you build trust: every claim has receipts.

---

## Memory Policy

Observation extraction and brief generation are governed by structured, versioned policies (per workspace or per entity type). Policies define which facets to extract, confidence thresholds, conflict behavior, and brief templates. Every derived output is tagged with the policy version that produced it.

---

## Retrieval Strategy
1. Structured filters for exact constraints.
2. FTS for keyword search across entity properties.
3. Graph traversal for relationship-heavy queries.
4. Progressive retrieval: brief → observations → artifacts.
5. Optional vector search for semantic discovery (future).

