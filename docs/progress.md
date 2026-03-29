# Delivery Progress

> This repository is currently in the pre-init template state.
> It can be inspected and validated as-is, but planning stays blocked until `harness:init` or discovery produces docs-ready inputs.

---

## Planning Status

| Surface | Status | Notes |
|--------|--------|-------|
| `docs/product.md` | Pending | Replace placeholders, run `bun run harness:init`, or use `bun run harness:discover --reset` |
| `docs/architecture.md` | Pending | Replace placeholders, run `bun run harness:init`, or use `bun run harness:discover --reset` |
| Discovery | Optional | Run `bun run harness:discover --reset` to enter the guided PRD/architecture path |
| Backlog sync | Blocked | Run `bun run harness:init` or finish discovery before `bun run harness:plan` |
| Task loop | Blocked | `harness:orchestrate` and `harness:evaluate` depend on a planned backlog |

---

## Milestones

| Milestone | Goal | Status | Depends On | Parallel | Worktree |
|-----------|------|--------|------------|----------|----------|
| *(run `bun run harness:plan` to generate milestone records)* | - | - | - | - | - |

---

## Tasks

| Task | Milestone | Kind | Status | Validation | Notes |
|------|-----------|------|--------|------------|-------|
| *(run `bun run harness:plan` to generate starter tasks)* | - | - | - | - | - |

---

## Active Worktrees

| Worktree | Milestone | Branch | Status |
|----------|-----------|--------|--------|
| - | - | - | No active milestone worktrees |

---

## Activity Log

- Template scaffold committed. Run `bun run harness:init -- <name>` to personalize the repo before planning.
