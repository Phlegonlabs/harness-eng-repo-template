# Execution Plan: Claude Code Reliability And Resume Enhancements

> **Status:** In Progress | **Created:** 2026-03-31 | **Owner:** Codex
> **Ticket/Issue:** Runtime reliability and long-task handoff improvements

## Objective

Strengthen day-to-day harness runtime stability and improve long-task resume and handoff surfaces by extending the existing evaluator, compact snapshot, and status outputs.

## Scope

### In Scope
- Add evaluator command timeout and infrastructure-failure retry behavior.
- Record richer gate execution metadata in evaluation artifacts.
- Surface better resume pointers in `harness:status --json` and `harness:compact`.
- Keep all new state and artifacts repo-owned under `docs/` or `.harness/`.
- Update workflow docs to reflect the new reliability and resume behavior.

### Out of Scope
- Replacing the current contract-driven task loop.
- Introducing a coordinator runtime or mailbox system outside the repository.
- Randomizing task IDs or changing milestone/task identity semantics.
- Reworking milestone parallel dispatch in this first iteration.

## Pre-requisites

- [x] ADR reviewed for extending the existing runtime instead of creating a parallel lifecycle (`docs/decisions/001-evaluation-review-integration.md`)
- [x] Architecture reviewed — runtime changes remain inside `harness/runtime/`
- [x] Dependencies identified — evaluator, compact, status, config, docs, and tests are the affected surfaces
- [x] Research done — current evaluator, compact, state recovery, and Claude Code reference patterns were reviewed

---

## Implementation Steps

Follow the existing harness runtime model and extend the current loop rather than replacing it.

### Phase 1: Runtime Types And Config
- [x] Extend runtime types for richer gate execution metadata and resume/status surfaces.
- [x] Add evaluator reliability settings to `harness/config.json`.
- [x] Keep config defaults backward-compatible when the new settings are absent.

### Phase 2: Evaluation Reliability
- [x] Upgrade the command runner to support timeout handling and infrastructure-failure retries.
- [x] Keep evaluator gate ordering and blocking semantics unchanged.
- [x] Record attempt counts, timeout status, and recovery metadata in evaluation artifacts.
- [x] Add targeted tests for timeout, retry, and recovered gate execution.

### Phase 3: Resume And Handoff Surfaces
- [x] Extend `harness:status --json` with resume-oriented snapshot metadata.
- [x] Extend `harness:compact` to include recent state snapshots and recommended resume artifacts.
- [x] Ensure the latest contract, evaluation, and handoff artifacts remain the primary resume pointers.
- [x] Add recent evaluation/handoff history and resume sequencing hints to compact snapshots.
- [x] Add recommended recovery points and rollback snapshots to `status` and `state-recover`.

### Phase 4: Documentation And Verification
- [x] Update workflow docs for the new evaluator reliability and resume behavior.
- [x] Run targeted tests for runtime changes.
- [x] Run `bun run harness:validate`.

---

## Verification

Before marking this plan complete:

- [x] `bun run harness:validate` passes
- [x] New runtime code has corresponding tests
- [ ] `bun run harness:structural` passes
- [x] `docs/internal/orchestrator-workflow.md` updated for evaluator/runtime changes
- [x] No new durable state is introduced outside `docs/` and `.harness/`

---

## Rollback Plan

1. Revert the evaluator reliability and resume-surface changes in one commit.
2. Restore the previous config and workflow docs from git if downstream tooling relies on the old schema.

---

## Open Questions

- [ ] Whether heartbeat output should be added in a second pass using a streaming process runner instead of `execFileSync`. *Owner: project leads, Due: after Phase 2 lands*
