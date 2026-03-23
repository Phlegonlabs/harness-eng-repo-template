# CLAUDE.md

> Claude Code specific instructions. Shared rules live in `docs/internal/agent-entry.md`.
> **If this file diverges from `docs/internal/agent-entry.md`, the shared doc wins.**

---

## Read First

Same order as `AGENTS.md` — for large tasks also read:
- `docs/internal/agent-entry.md` (canonical rules)
- `docs/internal/boundaries.md` (what requires approval)
- `docs/internal/dependency-layers.md` (layer model)

---

## Claude Code Tool Usage

Prefer dedicated tools over bash equivalents:

| Task | Use This | Not This |
|------|----------|----------|
| Read a file | `Read` tool | `cat`, `head`, `tail` |
| Edit a file | `Edit` tool (targeted) | `sed`, `awk` |
| Create a file | `Write` tool | `echo >`, `cat <<EOF` |
| Search files | `Glob` tool | `find`, `ls` |
| Search content | `Grep` tool | `grep`, `rg` |
| Complex search | `Agent` (Explore) | multiple greps |

Use `Bash` only for actual shell operations (running scripts, git commands, etc.).

---

## Task Tracking

For multi-step work, use `TodoWrite` to track progress:
- Create todos at the start of a session
- Mark `in_progress` before starting each task
- Mark `completed` immediately when done
- Keep at most 1 task `in_progress` at a time

---

## Commit Conventions

```
type(scope): description

Types: feat, fix, docs, refactor, test, chore, harness
```

When committing:
1. Stage specific files (not `git add -A` or `git add .`)
2. Use a HEREDOC for multi-line commit messages
3. Never skip hooks (`--no-verify`)

---

## Available Scripts

| Script | Purpose |
|--------|---------|
| `./harness/scripts/bootstrap.sh <name>` | Initialize with project name |
| `./harness/scripts/doctor.sh` | Health check |
| `./harness/scripts/validate.sh` | Full validation (run before handoff) |
| `./harness/scripts/install-hooks.sh` | Install git hooks |

---

## Validation Requirement

Run `./harness/scripts/validate.sh` before every handoff.
If it fails, fix the issue — do not hand off a broken state.

---

*Canonical rules: `docs/internal/agent-entry.md`*
