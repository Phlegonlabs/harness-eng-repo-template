# Tests

Your application tests live here. Follow these conventions.

## Structure

```
tests/
├── unit/         # Unit tests — test a single function or class in isolation
├── integration/  # Integration tests — test across layer boundaries with real deps
└── e2e/          # End-to-end tests — test full user flows
```

## Conventions

- Test files: use `*.test.*` or `*.spec.*` suffix
- Max 300 lines per test file — split by concern if needed
- Test files mirror the relevant workspace structure (e.g., `apps/api/src/service/auth.ts` → `tests/unit/apps-api/service/auth.test.ts`)
- Do not mock database or external services in integration tests — use real dependencies

## Running Tests

```bash
# Add your test command here after configuring your stack
# e.g.:
# npm test
# pytest
# go test ./...
```

## Harness Structural Tests

The harness itself has structural checks in `harness/runtime/`. These test the repository structure, not application behavior:

```bash
bun run harness:structural
```

## See Also

- [Agent Entry — Testing conventions](../docs/internal/agent-entry.md)
- [Validation](../package.json)
