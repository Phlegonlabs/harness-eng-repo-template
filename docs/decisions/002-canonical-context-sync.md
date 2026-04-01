# ADR 002: Canonical Context Sync For Product, Architecture, And Design Inputs

## Status

Accepted

## Context

The harness already treats repository files as the durable source of truth. Product requirements and architecture are consumed through `docs/product.md` and `docs/architecture.md`, and planning readiness is enforced before orchestration starts.

Design inputs introduce a new variation: they may come from outside the repository and may include mixed formats such as markdown notes, screenshots, PDFs, and wireframe assets. A naive implementation would let runtime commands fetch or depend on external sources directly, or would move readiness detection from planning into orchestration.

That would create two problems:

- different commands would resolve different “current” sources of truth
- the existing `harness:plan -> harness:orchestrate` contract would split into separate readiness models

## Decision

The repository will normalize external context into canonical in-repo surfaces before the task loop consumes it.

Specifically:

1. `docs/product.md` and `docs/architecture.md` remain the canonical planning inputs.
2. `docs/design/` becomes the canonical optional frontend design context surface.
3. `harness:context:sync` copies local external sources into those canonical files or directories and records a manifest in `.harness/context/context-manifest.json`.
4. `harness:plan` remains the only place that blocks on product and architecture readiness.
5. `harness:orchestrate` consumes the normalized context by injecting generic `contextRefs` plus advisories into task contracts.

## Consequences

### Positive

- The repository keeps a single durable truth for agents and humans.
- Frontend tasks can consume optional design context without inventing a second lifecycle.
- External-source integration can grow later behind the sync command without changing the task loop.

### Negative

- Users need an explicit sync step when they source context from outside the repository.
- The first version supports local file and directory sync, not remote adapters.

## Follow-Up

- Add canonical `docs/design/` surfaces and frontend guidance docs.
- Add runtime context sync plus task-contract context injection.
- Extend sync later if remote-source adapters become necessary.
