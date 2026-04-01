# ADR 003: Extend The Existing Harness Runtime For Reliability And Resume Surfaces

## Status

Accepted

## Context

The harness already has a contract-driven task loop, state snapshots, compact snapshots, and task artifacts. The current weak spots are execution reliability around evaluation gates and the density of resume information exposed to agents during long-running work.

A naive response would be to introduce a second session runtime, external durable memory, or a coordinator-style control plane modeled after a different coding agent product. That would violate two existing repository constraints:

- the repository remains the only durable memory
- the current orchestrator/evaluator loop remains the canonical task lifecycle

## Decision

The repository will improve reliability and resume behavior by extending the current runtime surfaces.

Specifically:

1. `harness:evaluate` keeps its current sequential, blocking gate semantics.
2. The command runner gains timeout and infrastructure-failure retry support for evaluator commands.
3. Evaluation artifacts record attempt and recovery metadata instead of hiding retries inside console output.
4. `harness:status --json` and `harness:compact` become the primary resume surfaces for long-running work by exposing recent state snapshots and recommended artifact paths.
5. No new durable memory is introduced outside `docs/` and `.harness/`.

## Consequences

### Positive

- Day-to-day evaluation runs become more resilient to transient process failures.
- Long-running tasks become easier to resume without re-reading multiple artifacts.
- The runtime stays coherent with the existing task contract model.

### Negative

- Evaluation and compact artifact schemas grow and require targeted test updates.
- A future streaming runner may still be needed if heartbeat output becomes mandatory.

## Follow-Up

- Add evaluator reliability settings to `harness/config.json`.
- Extend runtime tests for retries, timeouts, and resume metadata.
- Update internal workflow docs once the changes land.
