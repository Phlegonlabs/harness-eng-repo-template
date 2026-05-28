# Execution Plan: Template Readiness Refresh

> **Status:** Complete | **Created:** 2026-05-28 | **Owner:** Codex
> **Ticket/Issue:** Local template readiness refresh

## Objective

Restore the pre-init template baseline to a state where docs freshness, structural tests, and CI-equivalent validation can pass without adding product-specific behavior.

## Scope

### In Scope
- Refresh readiness docs that are tracked by doc freshness rules.
- Harden harness runtime tests around guardian timing, command diagnostics, and Windows process cleanup.
- Run targeted runtime tests, structural checks, and final validation gates.
- Update quality evidence if the scoring surface changes.

### Out of Scope
- Running root `harness:plan` into committed template state.
- Adding external dependencies or product-specific business logic.
- Changing public command surfaces, schemas, package scripts, or harness rules.

## Implementation Steps

### Phase 1: Runtime Test Reliability
- [x] Increase guardian test timeout for Windows runs that cross the default 5s boundary.
- [x] Add command-flow test diagnostics that include command identity, cwd, stdout, and stderr.
- [x] Tighten Windows cleanup for spawned Bun, Node, Turbo, and shell wrapper processes in temp repos.
- [x] Treat edited docs as fresh during pre-commit validation so stale-doc fixes can be committed without bypassing hooks.

### Phase 2: Readiness Docs
- [x] Update `docs/progress.md` with May 28, 2026 readiness findings.
- [x] Refresh `docs/product.md`, `docs/architecture.md`, and `docs/internal/orchestrator-workflow.md` where they still match runtime behavior.
- [x] Preserve the pre-init template baseline and avoid materializing starter tasks into root state.

## Verification

- [x] `bun test harness/runtime/guardian.test.ts --timeout 20000`
- [x] `bun test harness/runtime/command-flow.test.ts --timeout 120000`
- [x] `bun run harness:quality --score`
- [x] `bun run harness:structural`
- [x] `bun run harness:validate`
- [x] `bun run harness:validate:full`
- [x] `bun run harness:guardian --mode preflight`

## Rollback Plan

1. Revert the readiness refresh commit.
2. Re-run `bun run harness:validate` to confirm the prior baseline behavior is restored.

## Open Questions

- None.
