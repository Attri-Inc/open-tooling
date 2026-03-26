# Open Tooling

**AI-native open-source SaaS tools — built for agents, configurable to your workflow.**

Open Tooling is a family of headless, local-first business tools designed for AI agents as the primary interface. Each tool is a standalone module with its own REST API, MCP server, and evidence-first data layer.

## Modules

| Module | Description | Status |
|--------|-------------|--------|
| [**CRM**](./crm) | Agent-first CRM with evidence-based memory, 29 REST endpoints, 27 MCP tools | v1.0 |

More modules coming — covering verticals like HR, Finance, Project Management, Procurement, and beyond.

## See It in Action

![CRM Setup Demo](https://raw.githubusercontent.com/Attri-Inc/open-tooling-plugins/main/assets/crm-setup-demo.gif)

> From zero to a running CRM in under two minutes. Install the plugin, clone the repo, and Claude configures everything.

## Plugin Marketplace

Install the [Open Tooling Plugins](https://github.com/Attri-Inc/open-tooling-plugins) in Claude Desktop or Cowork for instant agent-ready workflows:

1. Go to **Customize → Browse plugins → Personal → Add marketplace**
2. Enter: `Attri-Inc/open-tooling-plugins`
3. Click **Sync**

## Architecture

Every Open Tooling module shares the same architectural DNA:

- **Headless** — No bundled UI. REST API + MCP server are the interfaces.
- **Local-first** — SQLite-backed, zero cloud dependencies. Self-hostable.
- **Evidence-first** — Structured memory with provenance and audit trails.
- **Agent-first** — Designed for AI agents to ingest, extract, and take action.
- **Vendor-neutral** — No lock-in to any LLM provider or agent framework.

## Quick Start

```bash
git clone https://github.com/Attri-Inc/open-tooling.git
cd open-tooling/crm
npm install && cp .env.example .env
npm run dev
```

## Compatibility

Open Tooling works with any MCP-compatible AI client, including Claude Desktop, Claude Cowork, Claude Code, [OpenClaw](https://openclaw.com), and more.

## Support

For help setting things up, custom implementations, or building automations on Open Tooling, contact [hello@attri.ai](mailto:hello@attri.ai).

## License

Apache 2.0
