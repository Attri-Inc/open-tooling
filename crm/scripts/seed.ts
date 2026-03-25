/**
 * Seed script — populates the database with sample CRM data.
 * Usage: npm run seed
 */

import { initDb, createEntity, createRelationship, createArtifact, createObservation, createBrief } from "../src/db.js";

const db = initDb();
console.log("Seeding database...\n");

// ── Contacts ──────────────────────────────────────────────────────

const alice = createEntity({
  type: "contact",
  properties: { full_name: "Alice Chen", email: "alice@acme.com", title: "CTO", phone: "+1-555-0101" },
  summary: "Technical decision maker at Acme Corp. Drives architecture choices.",
  confidence: 0.95,
}, { actor: "seed-script" });

const bob = createEntity({
  type: "contact",
  properties: { full_name: "Bob Martinez", email: "bob@acme.com", title: "VP Engineering" },
  summary: "Reports to Alice. Manages day-to-day engineering ops.",
  confidence: 0.9,
}, { actor: "seed-script" });

const carol = createEntity({
  type: "contact",
  properties: { full_name: "Carol Davis", email: "carol@widgets.io", title: "Head of Product" },
  summary: "Key champion at Widgets Inc. Sponsored the initial POC.",
}, { actor: "seed-script" });

// ── Companies ─────────────────────────────────────────────────────

const acme = createEntity({
  type: "company",
  properties: { name: "Acme Corp", industry: "SaaS", size: "200-500", website: "https://acme.com" },
  summary: "Mid-market SaaS company. Active prospect with strong technical interest.",
}, { actor: "seed-script" });

const widgets = createEntity({
  type: "company",
  properties: { name: "Widgets Inc", industry: "E-commerce", size: "50-200", website: "https://widgets.io" },
  summary: "Growing e-commerce platform. Currently in pilot phase.",
}, { actor: "seed-script" });

// ── Deals ─────────────────────────────────────────────────────────

const acmeDeal = createEntity({
  type: "deal",
  properties: { name: "Acme Corp — Platform License", value: 120000, stage: "negotiation", currency: "USD" },
  summary: "Enterprise license for Acme. Budget confirmed by CTO.",
  confidence: 0.85,
}, { actor: "seed-script" });

const widgetsDeal = createEntity({
  type: "deal",
  properties: { name: "Widgets Inc — Pilot", value: 25000, stage: "evaluation", currency: "USD" },
  summary: "Initial pilot with Widgets. Decision expected Q2.",
}, { actor: "seed-script" });

// ── Relationships ─────────────────────────────────────────────────

createRelationship({ from_id: alice.id, to_id: acme.id, type: "EMPLOYED_AT" }, { actor: "seed-script" });
createRelationship({ from_id: bob.id, to_id: acme.id, type: "EMPLOYED_AT" }, { actor: "seed-script" });
createRelationship({ from_id: carol.id, to_id: widgets.id, type: "EMPLOYED_AT" }, { actor: "seed-script" });
createRelationship({ from_id: acme.id, to_id: acmeDeal.id, type: "ASSOCIATED_WITH" }, { actor: "seed-script" });
createRelationship({ from_id: widgets.id, to_id: widgetsDeal.id, type: "ASSOCIATED_WITH" }, { actor: "seed-script" });
createRelationship({ from_id: alice.id, to_id: acmeDeal.id, type: "ASSOCIATED_WITH" }, { actor: "seed-script" });
createRelationship({ from_id: carol.id, to_id: widgetsDeal.id, type: "ASSOCIATED_WITH" }, { actor: "seed-script" });

// ── Artifacts ─────────────────────────────────────────────────────

const emailArtifact = createArtifact({
  artifact_type: "email",
  title: "Re: Platform License Pricing",
  content: "Hi team,\n\nThanks for the proposal. Our budget for this is $120k and we'd like to move forward. Alice has approved the architecture and Bob will handle the integration timeline.\n\nBest,\nAlice Chen\nCTO, Acme Corp",
  participants: [alice.id, bob.id],
});

const meetingArtifact = createArtifact({
  artifact_type: "meeting_notes",
  title: "Widgets Pilot Kickoff",
  content: "Attendees: Carol Davis, Sales Team\n\nDiscussed:\n- Pilot scope: 3 months, 10 users\n- Budget: $25k for pilot period\n- Success criteria: 2x improvement in response time\n- Next step: Technical setup call next Tuesday",
  participants: [carol.id],
});

// ── Observations ──────────────────────────────────────────────────

const obs1 = createObservation({
  entity_id: acmeDeal.id,
  artifact_id: emailArtifact.id,
  observation_type: "field_value",
  field_path: "properties.value",
  value: 120000,
  snippet: "Our budget for this is $120k",
  confidence: 0.95,
});

const obs2 = createObservation({
  entity_id: acmeDeal.id,
  artifact_id: emailArtifact.id,
  observation_type: "field_value",
  field_path: "properties.stage",
  value: "negotiation",
  snippet: "we'd like to move forward",
  confidence: 0.9,
});

const obs3 = createObservation({
  entity_id: widgetsDeal.id,
  artifact_id: meetingArtifact.id,
  observation_type: "field_value",
  field_path: "properties.value",
  value: 25000,
  snippet: "Budget: $25k for pilot period",
  confidence: 0.9,
});

// ── Briefs ────────────────────────────────────────────────────────

createBrief({
  entity_id: acmeDeal.id,
  brief_type: "deal_summary",
  content: `Acme Corp platform license deal valued at $120k [${obs1.id}]. Currently in negotiation stage [${obs2.id}]. Alice Chen (CTO) has approved the architecture and budget. Bob Martinez will manage integration.`,
  observation_ids: [obs1.id, obs2.id],
  generated_by: "seed-script",
});

createBrief({
  entity_id: widgetsDeal.id,
  brief_type: "deal_summary",
  content: `Widgets Inc pilot valued at $25k [${obs3.id}]. 3-month pilot with 10 users. Success criteria: 2x improvement in response time. Decision expected Q2.`,
  observation_ids: [obs3.id],
  generated_by: "seed-script",
});

// ── Summary ───────────────────────────────────────────────────────

console.log("Seeded:");
console.log(`  3 contacts:  ${alice.id}, ${bob.id}, ${carol.id}`);
console.log(`  2 companies: ${acme.id}, ${widgets.id}`);
console.log(`  2 deals:     ${acmeDeal.id}, ${widgetsDeal.id}`);
console.log(`  7 relationships`);
console.log(`  2 artifacts`);
console.log(`  3 observations`);
console.log(`  2 briefs`);
console.log("\nDone.");

db.close();
