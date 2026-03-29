# Execution Plan: Harness Agent Ergonomics

> **Status:** Complete | **Created:** 2026-03-29 | **Owner:** Codex
> **Ticket/Issue:** repository enhancement plan

## Objective

Reduce agent startup overhead and improve recovery/inspection ergonomics without introducing duplicate state surfaces that can drift.

## Scope

### In Scope
- Harden `.harness/state.json` writes and add snapshot recovery tooling
- Add a derived `harness:status --json` command
- Consolidate agent-facing entry docs into `AGENTS.md` plus tool adapters
- Add realistic eval scaffolding aligned with the current template

### Out of Scope
- Replacing Bun with another runtime
- Adding browser dashboards
- Introducing model-graded evaluation infrastructure

## Pre-requisites

- [x] Architecture reviewed — runtime, validation, and command surfaces mapped
- [x] Dependencies identified — changes stay within existing Bun/TS toolchain
- [x] Research done — current orchestration, validation, and eval paths inspected
- [ ] ADR written if these workflow changes become long-term policy beyond the template

---

## Implementation Steps

### Phase 1: Runtime Persistence
- [x] Add atomic state-file writes in `harness/runtime/shared.ts`
- [x] Add snapshot/recovery helpers in `harness/runtime/state-recovery.ts`
- [x] Wire snapshots into `saveState()`
- [x] Add `harness:state-recover`

### Phase 2: Status Surface
- [x] Add a derived `harness:status --json` command
- [x] Extend command-surface metadata and command-flow tests
- [x] Keep generated command-surface docs synchronized

### Phase 3: Agent Entry Docs
- [x] Rewrite `AGENTS.md` as the self-contained entry point
- [x] Slim `CLAUDE.md`
- [x] Add `CODEX.md`
- [x] Update validation/doctor required surfaces

### Phase 4: Eval Scaffolding
- [x] Replace placeholder-only eval flow with runnable deterministic checks
- [x] Add two real eval tasks aligned with the current scaffold

### Phase 5: Verification
- [x] Run focused runtime tests
- [x] Run `bun run harness:validate`
- [x] Fix regressions and resync generated docs

---

## Rollback Plan

1. Revert the harness runtime/doc changes as one commit if the new command surfaces fail validation.
2. Delete generated snapshot artifacts and rerun `bun run harness:plan` if state surfaces become inconsistent.

## Open Questions

- [ ] Should profile-aware layer configuration be revisited later as a scaffolding concern rather than a lint concern?
