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
| GitHub Actions | outbound | CI workflow execution | Runs `bun install` and `bun run harness:validate:full` on pushes and pull requests |
| Package registry | outbound | package manager network access | Used during `bun install` to resolve dependencies |
| Product-specific external systems | outbound or inbound | project-defined later | Intentionally not preconfigured in the template baseline |

---

## Interfaces & Contracts

### Root command contract
```text
bun run harness:init -- <project-name>
bun run harness:guardian --mode preflight
bun run harness:compact
bun run harness:dispatch --prepare --role sidecar
bun run build
bun run test
bun run harness:evaluate --task <id> --all
bun run harness:self-review --report
bun run harness:docs --report
bun run harness:quality --score
bun run harness:validate
bun run harness:validate:full
```

### Workspace contract
```text
apps/* and packages/* each expose package.json scripts for build, lint, typecheck, and test.
Cross-workspace reuse happens through package exports such as @<project>/shared.
```

### Documentation contract
```text
docs/product.md and docs/architecture.md are the human-readable source of truth.
harness:plan reads them to materialize milestone and task placeholders.
.harness/contracts, .harness/evaluations, .harness/handoffs, and .harness/compact store execution artifacts.
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
| **Logging** | Structured JSON logs through `@harness-template/shared`; see `docs/internal/observability.md` |
| **Observability** | Opt-in profile-based health and log commands live in the harness runtime and remain disabled until a project configures an active profile |
| **Error handling** | Keep domain and service code typed; reserve thrown errors for infrastructure boundaries |
| **Authentication** | Not preconfigured in the template; add it inside the relevant application workspace when product requirements exist |
| **Configuration** | Root and workspace environment variables flow through `.env` patterns and are validated by repository conventions |
| **Code organization** | Every workspace follows the same dependency layer order and uses package exports for reuse |

---

## Build / Distribution / Deployment

```bash
# Initialize the template for a real project
bun run harness:init -- <project-name>

# Build every workspace
bun run build

# Run all workspace tests
bun run test

# Fast local validation
bun run harness:validate

# Full CI-equivalent validation
bun run harness:validate:full

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
2. Use `bun run harness:guardian --mode preflight` before task activation or milestone dispatch.
3. Use `bun run harness:orchestrate` to open the active task contract.
4. Run `bun run harness:evaluate --task <id> --all` before marking a task done.
5. Confirm `bun run build`, `bun run test`, and `bun run typecheck` pass.
6. Run `bun run harness:compact` when a concise resume or handoff surface is helpful.
7. Run `bun run harness:self-review --report`, `bun run harness:docs --report`, and `bun run harness:quality --score` when the task touches runtime, docs, or policy surfaces.
8. Run `bun run harness:validate` before local handoff.
9. Run `bun run harness:validate:full` before relying on CI-equivalent harness coverage locally.
10. Use `bun run harness:discover --reset` only when the team wants a guided PRD and architecture interview flow.

---

## Architecture Readiness Checklist

- [x] System boundaries are explicit
- [x] Dependency direction is explicit
- [x] Interfaces/contracts are explicit enough to implement
- [x] Execution constraints for milestone splitting are explicit
- [x] No critical architecture unknown blocks backlog generation

---

*Last updated: 2026-03-30 | Owner: Project leads*
