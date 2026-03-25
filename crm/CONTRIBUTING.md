# Contributing to Open Tooling CRM

Thanks for your interest in contributing!

## Getting Started

```bash
git clone <repo-url>
cd open-tooling
cd crm
npm install
cp .env.example .env
npm test
```

## Development

```bash
npm run dev          # REST API with hot reload
npm run mcp          # MCP server (stdio)
npm test             # Run tests
npm run test:watch   # Watch mode
```

## Submitting Changes

1. Fork the repo and create a branch from `main`
2. Add tests for any new functionality
3. Ensure `npm test` and `npx tsc --noEmit` pass
4. Submit a pull request

## Reporting Bugs

Open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS

## Code Style

- TypeScript strict mode
- Zod validation for all external inputs
- Tests for db layer and API endpoints

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
