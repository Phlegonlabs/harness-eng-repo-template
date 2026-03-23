# Harness Template

A reusable starter for **agent-first development** with:

- Bun workspaces + Turbo
- TypeScript-ready apps and packages
- Ready-to-edit engineering baseline docs
- Optional PRD / architecture discovery
- milestone / task planning
- validation, hooks, and CI

---

## Start

```bash
git clone <this-repo> my-project && cd my-project
bun install
bun run harness:init -- my-project
bun run build
bun run test
bun run harness:validate
```

Use the runtime in this order:

1. `harness:init` personalizes the template for your project name and seeds ready-to-edit docs
2. Edit `docs/product.md` and `docs/architecture.md` as your repository becomes product-specific
3. `harness:plan` turns the docs into milestones/tasks in `docs/progress.md`
4. `harness:validate` remains the quality gate

---

## Workspace Layout

```text
apps/
  web/             # Frontend or client-facing app workspace
  api/             # API / worker / runtime workspace
packages/
  shared/          # Shared types, config, and reusable logic
harness/           # Validation, planning, and orchestration runtime
docs/              # PRD, architecture, progress, ADRs
```

The dependency layer model applies **inside each workspace**. Cross-workspace sharing should happen through package exports, not deep file imports.

---

## Core Files

| File | Purpose |
|------|---------|
| `docs/product.md` | PRD canon |
| `docs/architecture.md` | Architecture canon |
| `docs/progress.md` | Milestones + tasks |
| `.harness/state.json` | Machine state |
| `apps/*` | Application workspaces |
| `packages/*` | Shared libraries |
| `harness/runtime/` | Bun/TS harness runtime |
| `harness/rules/` | Mechanical rules |
| `AGENTS.md` / `CLAUDE.md` | Agent entrypoints |

---

## Commands

```bash
bun run harness:init -- <name>
bun run harness:doctor
bun run harness:discover --reset
bun run harness:plan
bun run build
bun run lint
bun run typecheck
bun run test
bun run harness:validate
bun run harness:orchestrate
bun run harness:parallel-dispatch -- --apply
bun run harness:merge-milestone -- M1
```

---

## Template Notes

- This repo is expected to validate before and after `harness:init`.
- The only intentional doctor warning is `project_name === "harness-template"` before initialization.
- `harness:discover --reset` is optional and re-enters guided discovery mode when a team wants PRD/architecture interviews.
- The default scaffold is a monorepo with `apps/web`, `apps/api`, and `packages/shared`.

Template ADRs:

- [docs/decisions/000-template.md](docs/decisions/000-template.md)
- [docs/decisions/001-harness-engineering.md](docs/decisions/001-harness-engineering.md)
- [docs/decisions/002-monorepo-template.md](docs/decisions/002-monorepo-template.md)

Operator guide:

- [docs/internal/operator-guide.md](docs/internal/operator-guide.md)
