# Execution Plan: Evaluation And Review Integration

> **Status:** In Progress | **Created:** 2026-03-30 | **Owner:** Codex
> **Ticket/Issue:** Repository improvement initiative

## Objective

Integrate structured evaluation gates, machine-readable self-review, golden-principle entropy checks, documentation freshness enforcement, quality scoring, and opt-in observability adapters into the existing harness runtime without creating a parallel task lifecycle.

## Scope

### In Scope
- Extend the existing task evaluator to support structured gates and richer evaluation artifacts.
- Upgrade `harness:self-review` into a machine-readable self-review pipeline.
- Add repo-owned rule surfaces for review, entropy, docs freshness, quality scoring, and observability profiles.
- Add quality reporting and automatic `docs/quality/GRADES.md` generation support.
- Add opt-in observability commands that block clearly when no profile is enabled.
- Update docs, command surfaces, and CI to reflect the new runtime behavior.

### Out of Scope
- Product-specific browser automation or screenshot capture flows.
- Automatic PR creation from local runtime commands.
- Replacing the task contract loop with a second orchestration model.

## Pre-requisites

- [x] ADR written for significant design decisions (see `docs/decisions/`)
- [x] Architecture reviewed — layer boundaries mapped, no violations expected
- [x] Dependencies identified — affected runtime, rules, docs, and workflow files are known
- [x] Research done — existing evaluator, self-review, entropy, and command-surface patterns were reviewed

---

## Implementation Steps

Follow the dependency layer order where applicable and extend existing primitives instead of creating duplicate surfaces.

### Phase 1: Runtime Types And Rule Surfaces
- [ ] Extend harness runtime types for evaluation gates, self-review reports, docs freshness reports, quality reports, and observability profiles
- [ ] Add rule files under `harness/rules/` for review checklist, golden principles, docs freshness, quality dimensions, and observability profiles
- [ ] Expand `harness/config.json` for quality and observability toggles

### Phase 2: Evaluation And Self-Review
- [ ] Upgrade task evaluation to run structured gates and emit richer evaluation artifacts
- [ ] Keep `validationChecks` as migration input only and move runtime logic onto resolved evaluation gates
- [ ] Upgrade `harness:self-review` to read `harness/rules/review-checklist.json`
- [ ] Add report and JSON output modes for self-review

### Phase 3: Entropy, Docs, And Quality
- [ ] Replace entropy-only warning scans with golden-principle-aware findings and report artifacts
- [ ] Add docs freshness rule handling and a dedicated `harness:docs` command surface
- [ ] Add `harness:quality` scoring and `docs/quality/GRADES.md` generation

### Phase 4: Opt-In Observability
- [ ] Add profile-based observability adapters and health/log commands
- [ ] Ensure disabled or missing profiles block clearly instead of assuming a web app exists
- [ ] Allow evaluation gates to reference runtime health checks without hardwiring them into the template default

### Phase 5: Documentation, CI, And Verification
- [ ] Update `AGENTS.md`, `CODEX.md`, `CLAUDE.md`, architecture, workflow, and command-surface docs
- [ ] Update GitHub workflows to run the upgraded self-review and quality/doc checks
- [ ] Run targeted tests plus `bun run harness:validate`

---

## Verification

Before marking this plan complete:

- [ ] `bun run harness:validate` passes
- [ ] Changed runtime code has corresponding tests
- [ ] `bun run harness:structural` passes
- [ ] `docs/internal/orchestrator-workflow.md` updated for evaluator changes
- [ ] `docs/progress.md` remains generated and in sync with runtime
- [ ] ADR captures why the existing runtime was extended rather than replaced

---

## Rollback Plan

1. Revert the runtime and rule-surface changes in one commit if the new evaluator/reporting surfaces prove unstable.
2. Restore the previous generated docs and CI workflow definitions from git.

---

## Open Questions

- [ ] Whether `harness:quality --compare` needs historical persistence beyond git-based comparison can remain deferred until real project data exists. *Owner: project leads, Due: after initial rollout*
