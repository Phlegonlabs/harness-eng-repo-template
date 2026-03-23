# Harness Engineering Bun Template

A reusable starter for **agent-first development** with:

- Bun + TypeScript runtime
- PRD / architecture discovery
- milestone / task planning
- validation, hooks, and CI

---

## Start

```bash
git clone <this-repo> my-project && cd my-project
bun install
bun run harness:bootstrap -- my-project
bun run harness:discover
bun run harness:plan
bun run harness:validate
```

Use the runtime in this order:

1. `harness:discover` fills `docs/product.md` and `docs/architecture.md`
2. `harness:plan` turns them into milestones/tasks in `docs/progress.md`
3. `harness:orchestrate` / `harness:parallel-dispatch` help execution
4. `harness:validate` is the quality gate

---

## Core Files

| File | Purpose |
|------|---------|
| `docs/product.md` | PRD canon |
| `docs/architecture.md` | Architecture canon |
| `docs/progress.md` | Milestones + tasks |
| `.harness/state.json` | Machine state |
| `harness/runtime/` | Bun/TS harness runtime |
| `harness/rules/` | Mechanical rules |
| `AGENTS.md` / `CLAUDE.md` | Agent entrypoints |

---

## Commands

```bash
bun run harness:bootstrap -- <name>
bun run harness:doctor
bun run harness:discover
bun run harness:plan
bun run harness:validate
bun run harness:orchestrate
bun run harness:parallel-dispatch -- --apply
bun run harness:merge-milestone -- M1
```

---

## Template Notes

- This repo is expected to validate in blank template state.
- The only intentional doctor warning is `project_name === "harness-template"` before bootstrap.
- `harness:plan` is expected to block until discovery has filled PRD + architecture.

Template ADRs:

- [docs/decisions/000-template.md](docs/decisions/000-template.md)
- [docs/decisions/001-harness-engineering.md](docs/decisions/001-harness-engineering.md)

Operator guide:

- [docs/internal/operator-guide.md](docs/internal/operator-guide.md)
