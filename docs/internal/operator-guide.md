# Operator Guide

Day-to-day workflow for humans managing this harness-engineering project.

---

## Core Start

### First Time Setup

```bash
# Clone and bootstrap
git clone <repo> my-project && cd my-project
./harness/scripts/bootstrap.sh my-project

# Verify everything is healthy
./harness/scripts/doctor.sh
```

Bootstrap does: replaces template placeholders, installs git hooks, runs doctor.

### Daily Workflow

```bash
# Check harness health
./harness/scripts/doctor.sh

# Run full validation before any PR
./harness/scripts/validate.sh
```

---

## Team Workflow

### Running a Validation

The validation suite is the CI contract. Run it before every PR:

```bash
./harness/scripts/validate.sh
```

Output:
- **PASS** — all checks green, ready for PR
- **FAIL** — something needs fixing, details printed inline

Individual checks:
```bash
./harness/linters/lint-all.sh               # linters only
./harness/structural-tests/test-all.sh      # structural tests only
./harness/entropy/scan-all.sh               # entropy scans only
```

### Managing Documentation

When architecture or conventions change:
1. Update the relevant `docs/` file
2. If it's a significant decision, create an ADR: `docs/decisions/NNN-title.md`
3. Run `./harness/entropy/scan-drift.sh` to check for doc/code divergence

### Working with Agents

Agent sessions should follow this pattern:
1. Point the agent at `AGENTS.md` or `CLAUDE.md`
2. Provide the specific task scope
3. Review the output for: correct layer usage, file sizes, conventional commits
4. Run `./harness/scripts/validate.sh` to confirm

For agent-submitted PRs, add the `agent-submitted` label — this triggers the stricter CI workflow in `.github/workflows/agent-pr.yml`.

### Updating Harness Rules

When a golden rule needs to change:
1. Document the reason in a new ADR (`docs/decisions/`)
2. Update the relevant `harness/rules/*.json` file
3. Update `docs/internal/agent-entry.md` if the rule affects agent behavior
4. Update the linter error message to reflect the new rule
5. Commit as `harness(rules): your description`

---

## Governance Templates

Use the templates in `docs/templates/` for:

| Template | When to Use |
|----------|------------|
| `adr.md` | Significant architectural decision |
| `runbook.md` | Operational procedure |

---

## Validation Contracts

### `doctor.sh` checks:
- All required harness files exist
- `harness/rules/*.json` files are valid JSON
- Git hooks are installed
- `jq` is available on PATH
- Template placeholders have been replaced (if bootstrapped)

### `validate.sh` checks (full suite):
- Everything in `doctor.sh`
- All linter rules (layers, file size, naming, forbidden patterns, doc freshness)
- All structural tests (architecture, required files, doc links)
- All entropy scans (drift, orphans, consistency)

---

## Troubleshooting

**Problem:** `validate.sh` fails with "jq not found"
**Fix:** Install jq — `brew install jq` (macOS) or `apt install jq` (Linux)

**Problem:** Pre-commit hook blocks a commit
**Fix:** Read the error message — it contains remediation instructions.
Do not use `--no-verify`. Fix the underlying issue.

**Problem:** `scan-drift.sh` reports AGENTS.md diverged from agent-entry.md
**Fix:** Update `AGENTS.md` to reflect the current rules in `docs/internal/agent-entry.md`.

**Problem:** A new agent session produces code that violates layer rules
**Fix:** Ensure the agent read `docs/internal/dependency-layers.md` before working.
Consider adding a reminder to `AGENTS.md`.
