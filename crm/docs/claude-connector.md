# Claude Connector Setup (MCP)

## 1) Install dependencies

```bash
npm install
```

## 2) Run the MCP server

```bash
npm run mcp
```

## 3) Add MCP config

Add this to your Claude Desktop MCP config, and adjust the absolute paths:

```json
{
  "mcpServers": {
    "open-tooling/crm": {
      "command": "/absolute/path/to/open-tooling/crm/node_modules/.bin/tsx",
      "args": [
        "/absolute/path/to/open-tooling/crm/src/mcp.ts"
      ],
      "env": {
        "CRM_DB_PATH": "/absolute/path/to/open-tooling/crm/data/crm.db"
      }
    }
  }
}
```

## 4) Verify tools

In Claude, you should see tools named `create_entity`, `search_entities`, and `traverse_graph`.
