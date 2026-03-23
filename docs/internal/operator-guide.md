# Operator Guide

## First Use

```bash
git clone <repo> my-project && cd my-project
bun install
bun run harness:bootstrap -- my-project
bun run harness:doctor
```

## Start a Project

```bash
bun run harness:discover
bun run harness:plan
```

Use discovery first.
Use planning only after PRD + architecture are ready.

## Day-to-Day

```bash
bun run harness:doctor
bun run harness:validate
```

Optional commands:

```bash
bun run harness:orchestrate
bun run harness:parallel-dispatch -- --apply
```

## What Each Surface Means

- `docs/product.md`: PRD canon
- `docs/architecture.md`: architecture canon
- `docs/progress.md`: human-readable backlog
- `.harness/state.json`: machine-owned state

## Template Expectations

- Blank template state is valid
- `project_name: "harness-template"` is the expected pre-bootstrap default
- `bun run harness:plan` should block until discovery has completed enough PRD + architecture content
