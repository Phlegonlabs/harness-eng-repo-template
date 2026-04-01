# Execution Plan: Design Context Integration

> **Status:** Draft | **Created:** 2026-03-31 | **Owner:** Codex
> **Ticket/Issue:** n/a

## Objective

Add canonical design-context surfaces and a repo-owned sync path so frontend work can consume PRD, architecture, design-system, component, and wireframe context through the existing harness loop.

## Scope

### In Scope
- Add `docs/design/` canonical surfaces and frontend guidance
- Add a frontend skill and skill-routing support
- Add `harness:context:sync` to normalize external context into repo-owned files
- Inject resolved context references into generated task contracts for frontend work
- Update docs, command-surface, and tests to match the new workflow

### Out of Scope
- Direct Notion, Figma, or remote-source integrations
- A new task lifecycle separate from `plan -> orchestrate -> evaluate`
- Making design docs required for non-frontend repositories

## Pre-requisites

- [x] Architecture reviewed — keep planning readiness in `harness:plan`
- [x] Dependencies identified — runtime, docs, skills, command surfaces, tests
- [x] Research done — current skill routing, contract rendering, and planning gates reviewed
- [x] ADR needed — canonical sync surface vs runtime-only external fetch

---

## Implementation Steps

### Phase 1: Context Surfaces
- [ ] Add `docs/design/overview.md`, `design-system.md`, `components.md`, and `wireframes/index.md`
- [ ] Update `AGENTS.md`, `CODEX.md`, `apps/web/AGENTS.md`, and `skills/implementation/SKILL.md`
- [ ] Add `skills/frontend/SKILL.md`
- [ ] Write ADR for repo-owned context sync and optional frontend design surfaces

### Phase 2: Runtime + Skill Routing
- [ ] Add a runtime context module for canonical paths, sync manifest handling, frontend detection, and contract context resolution
- [ ] Add `harness:context:sync` script and command-surface entry
- [ ] Update `harness/skills/registry.json` to file-pattern-load the frontend skill
- [ ] Extend task contract artifacts with `contextRefs` and advisories

### Phase 3: Verification + Docs Sync
- [ ] Add runtime tests for context sync and frontend contract context injection
- [ ] Update workflow and architecture docs to describe canonical context surfaces
- [ ] Regenerate `docs/internal/command-surface.md`
- [ ] Run validation and fix any regressions

---

## Verification

- [ ] `bun test harness/runtime/context.test.ts harness/runtime/orchestration.test.ts harness/runtime/command-surface.test.ts`
- [ ] `bun run harness:validate`
- [ ] `bun run harness:self-review --report`
- [ ] Command-surface doc matches generated output
- [ ] Frontend task contracts include design refs when available and advisories when missing

---

## Rollback Plan

1. Remove `harness:context:sync` and the context module if the workflow proves too heavy.
2. Keep `docs/design/` as passive docs only and stop contract injection.

---

## Open Questions

- [ ] Whether later versions should support remote source adapters instead of local-file sync only
