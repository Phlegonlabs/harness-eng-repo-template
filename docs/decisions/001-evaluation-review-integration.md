# ADR 001: Extend The Existing Harness Loop For Evaluation And Review

## Status

Accepted

## Context

The repository already has a contract-driven task loop with generated task contracts, evaluation artifacts, handoff artifacts, skill-driven exit gates, docs freshness linting, and entropy scans.

The proposed integration work adds deeper evaluation, self-review, entropy control, documentation freshness, quality scoring, and observability. A naive implementation would introduce a second set of task contracts, review commands, and runtime state for the same lifecycle.

That would create drift between:

- `TaskRecord.validationChecks` and a second gate schema
- `harness:self-review` and a new `harness:review` command
- the existing `.harness/contracts/`, `.harness/evaluations/`, and `.harness/handoffs/` surfaces and a second artifact family

## Decision

The repository will extend the current harness runtime instead of replacing it or adding a parallel lifecycle.

Specifically:

1. The current evaluator remains the canonical task pass/fail mechanism.
2. Structured evaluation gates will be added as richer metadata around the existing evaluation flow.
3. `harness:self-review` remains the canonical review command and gains report-oriented behavior instead of being replaced.
4. Docs freshness, entropy, and quality scoring will reuse the existing validation and artifact pipelines.
5. Observability will be opt-in and profile-based so the root harness remains product-agnostic.

## Consequences

### Positive

- The task loop remains coherent for both humans and agents.
- Existing docs and command surfaces need incremental updates rather than a rewrite.
- Current state artifacts remain usable.
- CI and local validation stay aligned.

### Negative

- Some transitional compatibility logic is needed while tasks still carry `validationChecks`.
- The initial implementation is more careful and incremental than a clean-sheet rewrite.

## Follow-Up

- Add structured gate metadata to task and evaluation artifacts.
- Add machine-readable self-review, docs, quality, and observability reports.
- Regenerate command-surface and workflow docs after the runtime changes land.
