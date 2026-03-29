# Execution Plan: Harness Validate Performance

> **Status:** Draft | **Created:** 2026-03-29 | **Owner:** Codex
> **Ticket/Issue:** validation performance optimization

## Objective

Reduce `bun run harness:validate` and `bun run harness:validate:full` latency by eliminating avoidable Bun subprocess overhead and redundant file-system / git work, while preserving the current output and exit-code contracts.

## Scope

### In Scope
- Run doctor, lint, structural subchecks, and entropy scans in-process where they already expose importable functions
- Add safe memoization for repeated `trackedFiles()` and `globToRegex()` calls
- Preserve standalone wrapper scripts such as `lint-layers.ts`, `test-doc-links.ts`, and `scan-drift.ts`
- Keep `bun test harness/runtime` as the only required subprocess in the full validation path

### Out of Scope
- Rewriting validation logic itself
- Changing validation severity rules or advisory-vs-blocking behavior
- Changing the command surface for individual wrapper scripts
- Optimizing the `bun test harness/runtime` runner

## Pre-requisites

- [x] Current `validate`, `validate:full`, `lint`, `entropy`, and structural command flows inspected
- [x] Existing validation functions confirmed importable via `validation.ts`
- [x] Current output / exit-code contracts mapped
- [ ] If validation command behavior changes beyond performance, capture that separately in docs or ADR form

---

## Implementation Steps

### Phase 1: Shared Caches In `shared.ts`
- [ ] Add a module-level cache for `trackedFiles(root)`
- [ ] Add `clearTrackedFilesCache(root?: string)` so tests and future writers can invalidate cached file lists
- [ ] Invalidate tracked-file cache automatically from `writeTextFile()` and `writeJson()` for the affected repo root
- [ ] Add a module-level cache for `globToRegex(pattern)`
- [ ] Add `clearGlobToRegexCache()` for tests if needed

Notes:
- `trackedFiles()` caching must be safe for same-process write-then-read flows; do not rely on tests to clear it manually.
- `globToRegex()` is safe to cache because these regexes are constructed without flags and do not carry mutable `lastIndex` state.

### Phase 2: Extract Reusable Runners
- [ ] Refactor `doctor.ts` to export `runDoctor(root: string): number`
- [ ] Keep `import.meta.main` behavior so `bun run harness:doctor` still works unchanged
- [ ] If needed, extract small internal helpers for the lint and entropy aggregators, but keep the wrapper commands themselves intact

### Phase 3: In-Process Aggregators
- [ ] Rewrite `validate.ts` to call `runDoctor`, `validationContext(root)`, and the existing lint/test/scan functions directly
- [ ] Create `validationContext(root)` once per top-level validation invocation and reuse it across all in-process checks
- [ ] Rewrite `lint-all.ts` to call the lint functions directly in-process
- [ ] Rewrite `entropy-all.ts` to call the scan functions directly in-process

Output/behavior requirements:
- Preserve existing section headers and PASS/FAIL summary lines
- Preserve `validate` hard-fail boundaries
- Preserve `entropy-all` as advisory-only: it must still exit 0 and print informational completion output even when scans emit warnings

### Phase 4: Full Validation And Structural Flow
- [ ] Do not duplicate structural orchestration logic in two places
- [ ] Extract a shared structural runner used by both `test-all.ts` and `validate-full.ts`, or have `validate-full.ts` call the shared structural runner directly rather than reimplementing the sequence
- [ ] Keep `bun test harness/runtime` as the subprocess-backed runtime regression step inside that structural flow
- [ ] Rewrite `validate-full.ts` to call doctor, lint, structural, and entropy in-process except for the runtime test subprocess

Behavior requirements:
- `bun run harness:structural` and the structural portion of `bun run harness:validate:full` must stay logically identical
- Avoid drift by ensuring one canonical structural composition path exists

### Phase 5: Read Optimization In `validation-entropy.ts`
- [ ] Rewrite `runOrphanScan()` to read markdown file contents once into a `Map<string, string>`
- [ ] Reuse the memoized tracked-file list instead of calling `trackedFiles()` repeatedly
- [ ] Preserve current orphan detection semantics and exclusions such as `docs/templates/`

---

## Files Modified

| File | Change |
|------|--------|
| `harness/runtime/shared.ts` | Add tracked-files and glob regex caches plus invalidation hooks |
| `harness/runtime/doctor.ts` | Export `runDoctor()` and keep standalone CLI path |
| `harness/runtime/validate.ts` | Switch to in-process execution |
| `harness/runtime/validate-full.ts` | Switch to in-process execution except Bun runtime tests |
| `harness/runtime/lint-all.ts` | Switch to in-process lint aggregation |
| `harness/runtime/entropy-all.ts` | Switch to in-process advisory aggregation |
| `harness/runtime/test-all.ts` | Share canonical structural composition path if needed |
| `harness/runtime/validation-entropy.ts` | Cache markdown reads and reuse tracked-file results |

## Files Not Modified

- `harness/runtime/validation.ts` function signatures stay intact
- `harness/runtime/validation-layering.ts` should benefit from caches without behavior changes
- Wrapper entrypoints such as `lint-layers.ts`, `test-doc-links.ts`, and `scan-drift.ts` stay available for standalone use
- `package.json` should not need script changes

---

## Verification

- [ ] `bun run harness:doctor` still works standalone
- [ ] `bun run harness:lint` still works standalone
- [ ] `bun run harness:entropy` still works standalone and remains advisory-only
- [ ] `bun run harness:structural` still works standalone
- [ ] `bun run harness:validate` passes with the same output shape and noticeably lower latency
- [ ] `bun run harness:validate:full` passes
- [ ] Individual wrappers such as `bun run harness/runtime/lint-layers.ts` still work
- [ ] `bun test harness/runtime` passes

## Rollback Plan

1. Revert the validation aggregator refactor as one change if output or exit-code drift appears.
2. Remove the caches if same-process invalidation proves harder than expected, but keep any safe in-process aggregator refactors that preserve behavior.

## Open Questions

- [ ] Should validation timing be measured and recorded in a follow-up doc once the refactor lands?
