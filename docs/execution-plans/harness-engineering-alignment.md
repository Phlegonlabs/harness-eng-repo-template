# Execution Plan: Harness Engineering Alignment

> **Status:** In Progress | **Created:** 2026-05-28 | **Owner:** Codex
> **Ticket/Issue:** repository alignment review follow-up

## Objective

Close the highest-priority harness gaps around task lifecycle clarity, parallel worktree safety, merge safety, and repo-owned quality/validation enforcement.

## Scope

### In Scope
- Align `docs/internal/orchestrator-workflow.md` with the runtime task and contract model
- Harden `harness:parallel-dispatch` and `harness:merge-milestone`
- Make `harness:validate:full` a strict superset of the fast validation suite
- Add configurable quality thresholds to `harness:quality`
- Improve `harness:status --json` so validation state comes from recent runtime evidence
- Add targeted regression coverage for the changed command paths

### Out of Scope
- New external issue tracker integrations
- Long-running daemon or coordinator services
- Provider-specific orchestration features outside the current repo-owned harness model

## Pre-requisites

- [x] Architecture reviewed — runtime and docs surfaces mapped
- [x] Dependencies identified — runtime, docs, and tests are the affected areas
- [x] Research done — current repo behavior and prior review plan loaded
- [x] ADR written for any new durable runtime policy that survives this iteration

---

## Implementation Steps

### Phase 1: Contracts
- [x] Re-read runtime lifecycle types and workflow docs
- [x] Add runtime-backed validation state tracking
- [x] Update the orchestration workflow doc to match actual task, contract, and evaluator fields

### Phase 2: Parallelism & Merge Safety
- [x] Treat missing affected areas as non-parallel by default
- [x] Derive milestone areas from milestone task scopes when explicit areas are empty
- [x] Block same-batch dispatch conflicts before worktrees are allocated
- [x] Require clean validated milestone worktrees with real branch deltas before merge
- [x] Record merge audit artifacts

### Phase 3: Validation & Quality Gates
- [x] Expand `validate:full` to include the fast validation steps plus structural coverage
- [x] Add configurable quality thresholds and an opt-in enforcement mode
- [x] Surface recent validation state in `harness:status --json`

### Phase 4: Regression Coverage
- [x] Add focused tests for lifecycle doc drift, dispatch safety, merge safety, validation step coverage, quality gating, and status aggregation
- [x] Add CLI failure-path tests for `harness:docs`, `harness:quality`, and `harness:self-review`

---

## Verification

- [ ] `bun test harness/runtime/parallel-dispatch.test.ts`
- [ ] `bun test harness/runtime/merge-milestone.test.ts`
- [ ] `bun test harness/runtime/validation.test.ts`
- [ ] `bun test harness/runtime/command-flow.test.ts --timeout 120000`
- [ ] `bun run lint`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] `bun run typecheck`
- [ ] `bun run format:check`
- [ ] `bun run harness:validate`
- [ ] `bun run harness:validate:full`
- [ ] `bun run harness:guardian --mode preflight`
- [ ] `bun run harness:status --json`

---

## Rollback Plan

1. Revert the harness runtime and docs changes together so task lifecycle docs do not drift from the code again.
2. Remove the new validation/merge artifact directories from `.gitignore` if the runtime changes are reverted.

---

## Open Questions

- [ ] Whether future quality thresholds should become default-on in local runs — *Owner: project leads, Due: next alignment review*
