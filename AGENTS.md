# AGENTS.md

> This file is the universal agent entry point. It is a **routing document** — not a rules dump.
> Read the sections below in order, then navigate to the deeper sources of truth.
>
> **If this file diverges from `docs/internal/agent-entry.md`, the shared doc wins.**

---

## Read First

For **small tasks** (single file, single concern):
1. This file
2. `docs/internal/agent-entry.md`

For **medium tasks** (cross-file, one layer):
1. This file
2. `docs/internal/agent-entry.md`
3. `docs/architecture.md`

For **large tasks** (new feature, cross-layer):
1. This file
2. `docs/internal/agent-entry.md`
3. `docs/product.md` + `docs/architecture.md`
4. `docs/internal/dependency-layers.md`
5. `docs/internal/boundaries.md`

---

## Project Context

| Document | Purpose |
|----------|---------|
| `docs/product.md` | What we're building and why |
| `docs/architecture.md` | How the system is structured |
| `docs/glossary.md` | Shared terminology |
| `docs/decisions/` | Architecture Decision Records (ADRs) |

---

## Critical Rules (inline summary)

Full rules live in `docs/internal/agent-entry.md`. These 6 are non-negotiable:

1. **Follow the dependency layer order** — see `harness/rules/dependency-layers.json`
   `Types → Config → Repo → Service → Runtime → UI`
   Each layer may only import from layers below it.

2. **Keep files under 500 lines** — see `harness/rules/file-size-limits.json`
   Split files that approach this limit into focused modules.

3. **Run validation before handing off** — `./harness/scripts/validate.sh`
   If it fails, fix it. Do not leave the harness in a broken state.

4. **Use conventional commits** — `type(scope): description`
   Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `harness`

5. **No backwards-compat code** — no `_old` suffixes, no dead exports, no TODO stubs
   If something is unused, delete it.

6. **Repository is the single source of truth** — decisions in Slack/chat are invisible to agents
   Anything important must be written into `docs/`.

---

## Three-Tier Boundaries

### ALWAYS DO
- Run `./harness/scripts/validate.sh` before any handoff
- Follow the dependency layer order in all new code
- Update `docs/` when making architectural decisions
- Use conventional commit format

### ASK FIRST
- Adding a new external dependency (package/library)
- Creating a new top-level directory
- Modifying files in `harness/rules/` (changing the golden rules)
- Changing CI/CD workflow files

### NEVER DO
- Skip or bypass validation
- Break the dependency layer order
- Commit secrets, API keys, or credentials
- Modify `.git/` directly
- Write backwards-compat shims for removed code

---

## Validation

```bash
./harness/scripts/validate.sh
```

This runs: health check → linters → structural tests → entropy scans.
All must pass before a PR is ready.

Quick individual checks:
```bash
./harness/scripts/doctor.sh          # health check only
./harness/linters/lint-all.sh        # linters only
./harness/structural-tests/test-all.sh  # structural tests only
./harness/entropy/scan-all.sh        # entropy scans only
```

---

## Tool Availability

Tools exposed via CLI in this repo:

| Command | Purpose |
|---------|---------|
| `./harness/scripts/bootstrap.sh <name>` | Initialize template with project name |
| `./harness/scripts/doctor.sh` | Health check — verify harness is intact |
| `./harness/scripts/validate.sh` | Full validation suite |
| `./harness/scripts/install-hooks.sh` | Install git hooks |

---

*Full canonical rules: `docs/internal/agent-entry.md`*
*Boundaries detail: `docs/internal/boundaries.md`*
*Layer model detail: `docs/internal/dependency-layers.md`*
