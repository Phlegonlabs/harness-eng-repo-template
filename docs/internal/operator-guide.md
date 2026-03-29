# Operator Guide

## First Use

Prefer GitHub's **Use this template** flow when creating a new repository from this scaffold. A downloaded ZIP or clone is also supported.

```bash
git clone <repo> my-project && cd my-project
bun install
bun run harness:init -- my-project
bun run harness:doctor
```

As cloned, the repository is a template scaffold, not an active execution backlog.

- Safe immediately: `harness:doctor`, `harness:validate`, `harness:status --json`, `harness:discover --reset`
- Blocked until init/discovery + docs readiness: `harness:plan`, `harness:orchestrate`, `harness:evaluate`

## Start a Project

```bash
bun run harness:plan
```

Use planning only after `harness:init` or the guided discovery flow has produced docs-ready product and architecture surfaces.

Optional guided path:

```bash
bun run harness:discover --reset
```

Run discovery only when you want an interview-style PRD and architecture flow.

## Day-to-Day

```bash
bun run harness:doctor
bun run harness:validate
bun run harness:validate:full
```

Use [`docs/internal/command-surface.md`](command-surface.md) to confirm whether a command should pass immediately, boot persistently, or block until more setup exists.

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

- The template validates before and after `harness:init`
- `project_name: "harness-template"` is the expected pre-init default
- `bun run harness:plan` is intentionally blocked in the untouched template and should work immediately after initialization because the baseline docs become valid at that point
