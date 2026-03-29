# ADR-005: Structured Logging As The Default Observability Surface

**Date:** 2026-03-29
**Status:** Accepted
**Deciders:** Project maintainers

---

## Context

The template already forbids `console.*` in production-oriented source files, but it does not provide a canonical logger or a shared debugging workflow. Agents need a stable, repo-owned way to emit and inspect logs without reaching for ad hoc instrumentation.

---

## Decision

> We will use a repo-owned structured logger exported from `@harness-template/shared` because it provides a stable JSON logging contract without introducing an external dependency.

---

## Rationale

The template is meant to stay lightweight, inspectable, and easy for agents to understand.

**Considered alternatives:**
- **Option A (chosen):** Repo-owned structured logger wrapper — chosen because it keeps the logging contract explicit, dependency-free, and easy to evolve with the repo.
- **Option B:** Adopt a third-party logger immediately — rejected because the template does not yet need the extra dependency or abstraction surface.
- **Option C:** Keep relying on `console.*` guidance only — rejected because that forbids bad patterns without providing a canonical replacement.

---

## Consequences

### Positive
- Agents have a single, documented logging surface to use during debugging.
- Log output is machine-readable and consistent across workspaces.
- The repository can tighten logging rules without breaking the developer workflow.

### Negative / Trade-offs
- The template owns a small amount of logging code that must be maintained.
- The initial logger surface is intentionally minimal and does not provide a metrics or tracing backend.

### Risks
- The logger API could drift from actual usage patterns. *Mitigation: keep the surface small and update this ADR if the contract grows.*

---

## Implementation Notes

- Export the logger from `packages/shared/src/index.ts`.
- Document the debugging workflow in `docs/internal/observability.md`.
- Enforce the logging contract through `harness/rules/forbidden-patterns.json`.
