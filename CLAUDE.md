# CLAUDE.md

> Claude Code adapter for this repository.
> Shared rules live in `AGENTS.md`. Read that first.
> For deeper workflow detail, see `docs/internal/agent-entry.md` and `docs/internal/orchestrator-workflow.md`.

---

## What To Read

1. `AGENTS.md`
2. `CLAUDE.md`
3. Load deeper docs only if the task requires them

---

## Tool Mapping

Prefer Claude's structured tools over shell equivalents when both are available.

| Task | Prefer | Avoid |
|------|--------|-------|
| Read a file | `Read` | `cat`, `head`, `tail` |
| Edit a file | `Edit` | `sed`, `awk` |
| Create a file | `Write` | `echo >`, heredoc file creation |
| Search file names | `Glob` | `find`, `ls` |
| Search content | `Grep` | repeated shell grep calls |
| Broad codebase exploration | `Agent` / explorer | ad hoc multi-step shell probing |

Use `Bash` for actual command execution, validation, git, or script entrypoints.

---

## Claude-Specific Workflow

- Use `TodoWrite` for multi-step tasks.
- Keep one item `in_progress` at a time.
- Do not bypass hooks with `--no-verify`.
- Treat repo-owned runtime commands as canonical; Claude hooks are adapters, not alternate logic.
- Stage specific files instead of `git add .`.
- Canonical commit types remain: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `harness`.

---

## Commands You Will Use Often

- `bun run harness:status --json`
- `bun run harness:compact`
- `bun run harness:guardian --mode preflight`
- `bun run harness:orchestrate`
- `bun run harness:evaluate --task <id> --all`
- `bun run harness:evaluate --task <id> --gate <gate-id>`
- `bun run harness:validate`
- `bun run harness:validate:full`
- `bun run harness:self-review --report`
- `bun run harness:docs --report`
- `bun run harness:quality --score`

If you need the full matrix, read `docs/internal/command-surface.md`.

Use `bun run harness:self-review --report` before handoff when a change spans multiple files or mixes code and documentation.
Skill routing and evaluation exit gates are runtime-owned; Claude hooks should wrap the repo command path, not reimplement it.
