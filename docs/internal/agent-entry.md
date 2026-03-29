# Agent Entry — Deep Reference

> `AGENTS.md` is now the primary, self-contained entry point for agents.
> This document remains the deeper reference for rationale and expanded workflow detail.
> If this document and the runtime disagree, the runtime and validation suite win.

---

## Core Rules

### 1. Follow the Dependency Layer Order

The project enforces a strict import hierarchy. Read `docs/internal/dependency-layers.md` for the full model.

```
Types → Config → Repo → Service → Runtime → UI
```

- Each layer may only import from layers *below* (to the left of) it.
- In a monorepo, apply this rule **within each workspace** under `apps/*` and `packages/*`.
- Only files under each workspace's own `src/` tree count as application source in the template monorepo.
- `apps/*/src/index.ts` and `packages/*/src/index.ts` are explicit entrypoints/export barrels and may stay outside the six layers.
- Cross-workspace imports must go through package names and exported entrypoints, not another workspace's internal files.
- Layer violations are caught by `bun run harness:lint`.
- The machine-readable rules live in `harness/rules/dependency-layers.json`.

### 2. Keep Files Under 500 Lines

- Default limit: **500 lines** per source file.
- Test files: **300 lines**.
- Documentation: **1000 lines**.
- When a file approaches the limit, split it into focused modules.
- Limits defined in `harness/rules/file-size-limits.json`.

### 3. Use Conventional Commits

```
<type>(<scope>): <short description>

Types: feat, fix, docs, refactor, test, chore, harness
```

- `feat`: new functionality
- `fix`: bug fix
- `docs`: documentation only
- `refactor`: code change that neither adds a feature nor fixes a bug
- `test`: adding or updating tests
- `chore`: tooling, dependencies, config
- `harness`: changes to the harness itself (rules, linters, scripts)

### 4. No Backwards-Compat Code

- No `_old` or `_v2` file suffixes
- No dead exports kept "just in case"
- No TODO stubs left in committed code
- No compatibility shims for removed features
- If something is unused, delete it completely.

### 5. Repository is the Single Source of Truth

- Architectural decisions must live in `docs/decisions/` (ADRs)
- Conventions must live in this document or `docs/internal/`
- Anything not in the repository is invisible to agents

### 6. Validate Before Handoff

Run the default local validation suite before every handoff:

```bash
bun run harness:validate
```

Use `bun run harness:validate:full` when you need the full CI-equivalent suite, including harness runtime regression tests.
Do not hand off a broken state. If validation fails, fix it.
For active tasks, `bun run harness:evaluate --task <id>` is the task-level gate before a task may be considered done.

---

## Team Workflow

### Starting a Work Session

1. Read `AGENTS.md` or `CLAUDE.md` (your entry point)
2. Read this document (agent-entry.md)
3. Read `docs/product.md`, `docs/architecture.md`, and `docs/progress.md`
4. Read `docs/internal/orchestrator-workflow.md` for the planning/execution model
5. Identify the specific task and its scope
6. Check which layers will be touched (review `docs/internal/dependency-layers.md`)
7. Inspect the current task contract / latest handoff artifact when resuming in-flight work
8. Identify which workspace(s) are affected before editing

A fresh clone of this template is still a pre-init scaffold. Do not assume a runnable backlog exists until `harness:init` or discovery has produced docs-ready inputs and `harness:plan` has run.

### During Work

- Work depth-first: break large goals into small, testable building blocks
- Keep workspace boundaries explicit: apps consume packages through public exports
- Commit atomically — one logical change per commit
- Keep at most one significant change in flight at a time
- Prefer editing existing files over creating new ones
- When in doubt about scope, do less and ask

### Ending a Work Session / Handoff

1. Run `bun run harness:validate`
2. Fix any failures
3. Run `bun run harness:self-review` when the change spans multiple files or mixes code and docs
4. Run `bun run harness:evaluate --task <id>` for the active task if it is still in execution
5. Stage specific files (not `git add -A`)
6. Write a conventional commit message
7. Note any open questions or blockers in `docs/` if relevant

### Planning and Execution

- `docs/product.md` is the PRD canon
- `docs/architecture.md` is the architecture canon
- `docs/progress.md` is the human-readable milestone/task surface
- `.harness/state.json` is the machine execution canon
- `bun run harness:init -- <name>` personalizes the ready engineer baseline for a new project
- `bun run harness:discover --reset` is the optional guided flow for teams that want PRD/architecture interviews
- Generate milestones/tasks only after PRD + architecture are ready enough to execute
- Parallel execution is milestone-level only and must use isolated worktrees
- Skill loading follows `harness/skills/registry.json` with progressive disclosure

---

## Advanced Capabilities

### When to Search the Web

Before escalating a question or making an assumption about an external library or API:
- Search for current documentation
- Verify that the API/library version matches what's in the project

### When to Ask

If any of these are true, ask before proceeding:
- The task requires a new external dependency
- The task requires a new top-level directory
- The task would modify `harness/rules/` (changing golden rules)
- The scope is ambiguous and proceeding could cause significant rework

### Forbidden Patterns

See `harness/rules/forbidden-patterns.json` for the machine-readable list.
These patterns must never appear in committed code:
- Hardcoded secrets or API keys
- `console.log` in non-test, non-debug files (use the shared structured logger)
- Commented-out code blocks
- TODO comments without an issue reference

---

*Use this document when you need the expanded rationale behind the rules in `AGENTS.md`.*
