# System Architecture

> This document describes *how* the system is structured, not *what* it does (that's `product.md`).
> Agents read this to understand constraints before implementing.

---

## Architecture Overview

```
[Monorepo Root]
  ├── apps/web
  ├── apps/api
  ├── packages/shared
  ├── harness/
  └── docs/

[Each workspace follows]
Types → Config → Repo → Service → Runtime → UI
```

---

## Dependency Layer Model

This project enforces a strict dependency layer order. See `harness/rules/dependency-layers.json` for machine-readable rules.

```
Types → Config → Repo → Service → Runtime → UI
```

**Rule:** Each layer may only import from layers below (to the left) of it.
**Enforcement:** `bun run harness:lint` checks this on every commit.

| Layer | Directory | Allowed Imports |
|-------|-----------|-----------------|
| `types` | `apps/*/src/types/`, `packages/*/src/types/` | (none — foundational) |
| `config` | `apps/*/src/config/`, `packages/*/src/config/` | `types` |
| `repo` | `apps/*/src/repo/`, `packages/*/src/repo/` | `types`, `config` |
| `service` | `apps/*/src/service/`, `packages/*/src/service/` | `types`, `config`, `repo` |
| `runtime` | `apps/*/src/runtime/`, `packages/*/src/runtime/` | `types`, `config`, `repo`, `service` |
| `ui` | `apps/*/src/ui/`, `packages/*/src/ui/` | all layers |

---

## System Boundaries

| System | Direction | Protocol | Notes |
|--------|-----------|----------|-------|
| [External system 1] | inbound | [HTTP/gRPC/etc] | [notes] |
| [External system 2] | outbound | [HTTP/gRPC/etc] | [notes] |

---

## Interfaces & Contracts

### [Interface 1]
```
[Schema or API signature]
```

---

## Execution Constraints

| Constraint | Impact on Milestones | Notes |
|-----------|----------------------|-------|
| [Shared migration / external dependency / lock] | [Why it blocks or serializes work] | [notes] |

---

## Cross-Cutting Concerns

| Concern | Approach |
|---------|----------|
| **Logging** | Structured JSON logs, no `console.log` in production |
| **Error handling** | Errors typed at system boundaries, propagate as values inside |
| **Authentication** | [Your approach] |
| **Configuration** | Environment variables via `.env`, validated at startup from the root or workspace entrypoint |

---

## Build / Distribution / Deployment

```bash
# Build
bun run build

# Test
bun run test

# Deploy
[your deploy command]
```

---

## Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [Risk 1] | High/Med/Low | High/Med/Low | [Mitigation] |

---

## Validation Plan

1. `bun run harness:structural` — structural compliance
2. `bun run harness:lint` — linting and rule checks
3. `bun run harness:validate` — full harness validation

---

## Architecture Readiness Checklist

- [ ] System boundaries are explicit
- [ ] Dependency direction is explicit
- [ ] Interfaces/contracts are explicit enough to implement
- [ ] Execution constraints for milestone splitting are explicit
- [ ] No critical architecture unknown blocks backlog generation

---

*Last updated: [date] | Owner: [name]*
