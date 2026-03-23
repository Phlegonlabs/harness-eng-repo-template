# System Architecture

> **Template** — Replace all placeholder text with your project's actual architecture.
> This document describes *how* the system is structured, not *what* it does (that's `product.md`).
> Agents read this to understand constraints before implementing.

---

## Architecture Overview

<!-- High-level description of the system. Include an ASCII diagram if helpful. -->

```
[User / Client]
       │
       ▼
  ┌─────────┐
  │   UI    │  ← Runtime layer
  └────┬────┘
       │
  ┌────▼────┐
  │ Service │  ← Business logic layer
  └────┬────┘
       │
  ┌────▼────┐
  │  Repo   │  ← Data access layer
  └────┬────┘
       │
  ┌────▼────┐
  │ Config  │  ← Configuration layer
  └────┬────┘
       │
  ┌────▼────┐
  │  Types  │  ← Type definitions layer
  └─────────┘
```

---

## Dependency Layer Model

This project enforces a strict dependency layer order. See `harness/rules/dependency-layers.json` for machine-readable rules.

```
Types → Config → Repo → Service → Runtime → UI
```

**Rule:** Each layer may only import from layers below (to the left) of it.
**Enforcement:** `harness/linters/lint-layers.sh` checks this on every commit.

| Layer | Directory | Allowed Imports |
|-------|-----------|-----------------|
| `types` | `src/types/` | (none — foundational) |
| `config` | `src/config/` | `types` |
| `repo` | `src/repo/` | `types`, `config` |
| `service` | `src/service/` | `types`, `config`, `repo` |
| `runtime` | `src/runtime/` | `types`, `config`, `repo`, `service` |
| `ui` | `src/ui/` | all layers |

---

## System Boundaries

<!-- What are the external systems this service interacts with? -->

| System | Direction | Protocol | Notes |
|--------|-----------|----------|-------|
| [External system 1] | inbound | [HTTP/gRPC/etc] | [notes] |
| [External system 2] | outbound | [HTTP/gRPC/etc] | [notes] |

---

## Interfaces & Contracts

<!-- Key APIs, schemas, or protocols that cross system boundaries.
     These are the most stable contracts — change them carefully. -->

### [Interface 1]
```
[Schema or API signature]
```

---

## Cross-Cutting Concerns

| Concern | Approach |
|---------|----------|
| **Logging** | Structured JSON logs, no `console.log` in production |
| **Error handling** | Errors typed at system boundaries, propagate as values inside |
| **Authentication** | [Your approach] |
| **Configuration** | Environment variables via `.env`, validated at startup |

---

## Build / Distribution / Deployment

<!-- How is the system built and deployed? -->

```bash
# Build
[your build command]

# Test
[your test command]

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

How to verify the architecture is correctly implemented:

1. `./harness/structural-tests/test-architecture.sh` — layer boundary compliance
2. `./harness/structural-tests/test-required-files.sh` — required structure exists
3. `./harness/scripts/validate.sh` — full harness validation

---

*Last updated: [date] | Owner: [name]*
