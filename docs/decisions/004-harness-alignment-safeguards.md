# ADR 004: Harness Alignment Safeguards

## Status

Accepted

## Context

The harness runtime now supports milestone worktrees, task evaluation artifacts, validation reports, and quality reports. Those surfaces are useful only if the command flow remains deterministic and bounded.

Recent alignment work exposed three risks:

- milestone worktrees could be dispatched without resolved affected areas
- milestone merges needed stricter pre-merge evidence and audit output
- validation and quality commands needed durable status evidence without recursively invoking the full runtime suite from child commands

## Decision

The harness will keep milestone-level parallelism conservative and repository-owned:

1. `harness:parallel-dispatch` resolves affected areas from milestone or task scope and blocks missing or overlapping scopes.
2. `harness:merge-milestone` requires clean worktrees, complete tasks, branch deltas, preflight, and validation before merging.
3. Generated state/progress merge conflicts may be reconciled by the runtime; unsupported source conflicts block the merge.
4. Validation, guardian, evaluation, and merge commands write report artifacts that feed `harness:status --json`.
5. `harness:quality` may enforce explicit or configured thresholds, but its test-health signal uses workspace tests so quality gates do not recursively run full harness regression.
6. `harness:structural` defaults to a local structural smoke pass and accepts `--full-runtime` for command-flow regression.
7. Full harness regression remains owned by `harness:validate:full`.

## Consequences

### Positive

- Parallel milestone execution is less likely to overlap silently.
- Milestone merges leave auditable evidence and fail before unsafe reconciliation.
- Quality gates stay fast enough for command failure-path tests and local checks.
- Status snapshots can report recent validation state from runtime evidence.

### Negative

- Full validation remains intentionally expensive because it exercises command-flow integration.
- Local structural checks stay fast enough for repeated iteration.
- Quality scoring no longer treats the full harness runtime test suite as part of the test-health dimension; that coverage belongs to `validate:full`.

## Follow-Up

- Revisit whether configured quality thresholds should become default-on for local `harness:quality --score`.
- Track full-validation runtime if command-flow coverage grows beyond practical local handoff time.
