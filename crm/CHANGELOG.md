# Changelog

## v1.0.0

### Core
- Entity CRUD (contacts, companies, deals, interactions, tasks, agents)
- Typed relationships with 6 relationship types
- Full-text search (FTS5) across entity properties
- Structured property filters with comparison operators
- Graph traversal with depth control and direction filtering
- Append-only event ledger with actor context
- Field-level provenance tracking
- Idempotent write endpoints via `x-idempotency-key` header
- Import/export for full data portability

### Memory Layer
- **Artifacts**: Immutable evidence records (emails, call transcripts, meeting notes, documents)
- **Observations**: Typed claims extracted from artifacts with lifecycle management (current/superseded/retracted)
- **Briefs**: Derived summaries citing observations, regeneratable from evidence
- **Conflicts**: Explicit disagreement records with resolution workflow

### Interfaces
- REST API with Zod validation, pagination, and structured error responses
- MCP server (stdio) with 27 tools for Claude Desktop and other MCP clients
- JSON structured request logging
- Graceful shutdown (SIGTERM/SIGINT)

### Infrastructure
- Docker support (Dockerfile + docker-compose)
- SQLite with WAL mode for concurrent reads
- Seed script with sample CRM data
- GitHub Actions CI (typecheck + tests)
- 61 tests (db, API, schema validation)
