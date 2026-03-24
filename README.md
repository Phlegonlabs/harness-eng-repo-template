# Harness Template

A reusable **strict monorepo template** for agent-first engineering on Bun + Turbo.

It ships with:

- `apps/*` and `packages/*` workspaces
- repository-owned product, architecture, and progress docs
- machine-readable dependency rules for agents and linters
- full `harness:validate` quality gates
- structural regression tests for the harness itself

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

Recommended adoption order:

1. Run `harness:init` to personalize the project name and baseline docs
2. Replace the starter content in `docs/product.md` and `docs/architecture.md`
3. Run `harness:plan` when the docs are ready enough to generate milestones/tasks
4. Treat `harness:validate` as the pre-handoff and pre-push gate

---

## Monorepo Rules

This template treats only workspace-owned source trees as active application code:

- `apps/*/src`
- `packages/*/src`

The dependency layer model applies inside each workspace:

```text
Types → Config → Repo → Service → Runtime → UI
```

Cross-workspace sharing must go through public package exports such as `@<project>/shared`.
Deep imports into another workspace's `src/` or `dist/` tree are not allowed.

The only default unlayered exceptions are workspace entrypoints and export barrels such as:

- `apps/*/src/index.ts`
- `packages/*/src/index.ts`

Strict monorepo enforcement is recorded in:

- [docs/decisions/003-strict-monorepo-enforcement.md](docs/decisions/003-strict-monorepo-enforcement.md)

---

## Quality Gate

`bun run harness:validate` runs the full repository check:

1. `harness:doctor`
2. linters
3. structural tests
4. entropy scans

Structural validation includes regression tests for the harness runtime itself, so boundary rules are tested, not only documented.

The template is expected to validate both before and after `harness:init`.
The only intentional doctor warning in the untouched template is `project_name === "harness-template"` before initialization.

---

## Workspace Layout

```text
apps/
  web/             # Frontend or client-facing app workspace
  api/             # API / worker / runtime workspace
packages/
  shared/          # Shared types, config, repo/service helpers
harness/           # Validation, planning, and orchestration runtime
docs/              # PRD, architecture, progress, ADRs
```

Core repository surfaces:

| File | Purpose |
|------|---------|
| `docs/product.md` | PRD canon |
| `docs/architecture.md` | Architecture canon |
| `docs/progress.md` | Milestones + tasks |
| `.harness/state.json` | Machine execution state |
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

## Notes

- `harness:discover --reset` is optional. Use it when the team wants guided PRD / architecture interviews.
- `packages/shared` is the default home for shared contracts and reusable logic, but shared code should still respect the dependency layer model.
- Keep important decisions in `docs/`, not in chat history.

Template ADRs:

- [docs/decisions/000-template.md](docs/decisions/000-template.md)
- [docs/decisions/001-harness-engineering.md](docs/decisions/001-harness-engineering.md)
- [docs/decisions/002-monorepo-template.md](docs/decisions/002-monorepo-template.md)
- [docs/decisions/003-strict-monorepo-enforcement.md](docs/decisions/003-strict-monorepo-enforcement.md)

Operator guide:

- [docs/internal/operator-guide.md](docs/internal/operator-guide.md)
