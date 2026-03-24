# System Architecture

> This document describes *how* the system is structured, not *what* it does (that's `product.md`).
> Agents read this to understand constraints before implementing.

---

## Architecture Overview

```text
[Monorepo Root]
  ├── apps/web          # client-facing app workspace
  ├── apps/api          # API / runtime workspace
  ├── packages/shared   # shared types and reusable logic
  ├── harness/          # repository validation and orchestration runtime
  └── docs/             # product, architecture, ADRs, and progress surfaces

[Within each workspace]
Types → Config → Repo → Service → Runtime → UI
```

The engineer template assumes that feature work starts inside one or more application workspaces and pulls shared contracts into `packages/shared`. The harness stays at the root and governs validation, planning, and repository policy.

Strict monorepo enforcement details are recorded in [ADR-003](decisions/003-strict-monorepo-enforcement.md).

---

## Dependency Layer Model

This project enforces a strict dependency layer order. See `harness/rules/dependency-layers.json` for machine-readable rules.

```
Types → Config → Repo → Service → Runtime → UI
```

**Rule:** Each layer may only import from layers below (to the left) of it.
**Enforcement:** `bun run harness:lint` checks this on every commit.

Only `apps/*/src` and `packages/*/src` are treated as source roots in the template monorepo. `apps/*/src/index.ts` and `packages/*/src/index.ts` are explicit entrypoints/export barrels and may remain outside the six layers; every other workspace source file must match a declared layer directory or file pattern.

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
| Developer or coding agent | inbound | local CLI / editor | Edits repository files and runs root commands |
| GitHub Actions | outbound | CI workflow execution | Runs `bun install` and `bun run harness:validate` on pushes and pull requests |
| Package registry | outbound | package manager network access | Used during `bun install` to resolve dependencies |
| Product-specific external systems | outbound or inbound | project-defined later | Intentionally not preconfigured in the template baseline |

---

## Interfaces & Contracts

### Root command contract
```text
bun run harness:init -- <project-name>
bun run build
bun run test
bun run harness:validate
```

### Workspace contract
```text
apps/* and packages/* each expose package.json scripts for build, lint, typecheck, and test.
Cross-workspace reuse happens through package exports such as @<project>/shared.
Deep imports into another workspace's src/ or dist/ tree are not allowed.
```

### Documentation contract
```text
docs/product.md and docs/architecture.md are the human-readable source of truth.
harness:plan reads them to materialize milestone and task placeholders.
```

---

## Execution Constraints

| Constraint | Impact on Milestones | Notes |
|-----------|----------------------|-------|
| Changes in `packages/shared` can affect both app workspaces | Shared package changes may need to land before app-specific milestones finish | Use package exports to keep impact explicit |
| Changes in `harness/rules/` or validation runtime affect the whole repository | These changes should be reviewed carefully and usually run before parallel feature work | Repository policy is globally enforced |
| App-specific feature work can parallelize when workspaces and affected areas do not overlap | Milestones can run in separate worktrees when dependencies are clear | Use `harness:parallel-dispatch` only after backlog sync |

---

## Cross-Cutting Concerns

| Concern | Approach |
|---------|----------|
| **Logging** | Structured logging only; no `console.log` in production-oriented source files |
| **Error handling** | Keep domain and service code typed; reserve thrown errors for infrastructure boundaries |
| **Authentication** | Not preconfigured in the template; add it inside the relevant application workspace when product requirements exist |
| **Configuration** | Root and workspace environment variables flow through `.env` patterns and are validated by repository conventions |
| **Code organization** | Every workspace follows the same dependency layer order, keeps entrypoints explicit, and exports public entrypoints instead of deep internal imports |

---

## Build / Distribution / Deployment

```bash
# Initialize the template for a real project
bun run harness:init -- <project-name>

# Build every workspace
bun run build

# Run all workspace tests
bun run test

# Validate repository structure and rules
bun run harness:validate

# Deploy
# Add project-specific deploy commands once runtime targets are chosen
```

---

## Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Template docs drift from runtime behavior | Medium | High | Keep docs generated or updated alongside runtime changes and validate links continuously |
| Shared package becomes a dumping ground | Medium | Medium | Enforce public exports and keep feature-specific logic in the owning app until sharing is justified |
| Teams skip initialization and keep template naming too long | Medium | Medium | `harness:doctor` warns until `harness:init` has been run with a project-specific name |

---

## Validation Plan

1. Run `bun run harness:init -- <project-name>` when adopting the template.
2. Confirm `bun run build`, `bun run test`, and `bun run typecheck` pass.
3. Run `bun run harness:validate` before handoff or push.
4. Use `bun run harness:discover --reset` only when the team wants a guided PRD and architecture interview flow.

---

## Architecture Readiness Checklist

- [x] System boundaries are explicit
- [x] Dependency direction is explicit
- [x] Interfaces/contracts are explicit enough to implement
- [x] Execution constraints for milestone splitting are explicit
- [x] No critical architecture unknown blocks backlog generation

---

*Last updated: 2026-03-23 | Owner: Project leads*
