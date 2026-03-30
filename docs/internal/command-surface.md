# Command Surface

This document is generated from `harness/command-surface.json`.
A command is considered healthy when it either succeeds with its prerequisites met
or blocks clearly when those prerequisites are missing.
This contract applies equally to Codex and Claude sessions.

---

## Root Commands

| Command | Mode | Requires | Missing Prereq | Success | Summary |
|---------|------|----------|----------------|---------|---------|
| `bun run harness:init -- <name>` | root / one_shot | bun_install, git_repository | expected_block | exit_zero | Initialize the template for a named project. |
| `bun run harness:install-hooks` | root / one_shot | git_repository | expected_block | exit_zero | Install repository git hooks into .git/hooks. |
| `bun run harness:doctor` | root / one_shot | - | n/a | exit_zero | Run repository health checks and report missing setup. |
| `bun run harness:lint` | root / one_shot | - | n/a | exit_zero | Run the harness-specific lint suite. |
| `bun run harness:structural` | root / one_shot | - | n/a | exit_zero | Run structural tests for required files, docs, and runtime behavior. |
| `bun run harness:entropy` | root / one_shot | - | n/a | exit_zero | Run drift, orphan, and consistency scans. |
| `bun run harness:docs --report` | root / one_shot | - | n/a | exit_zero | Run documentation freshness and link checks and write a docs report. |
| `bun run harness:quality --score` | root / one_shot | - | n/a | exit_zero | Compute the current repository quality score and write a quality report artifact. |
| `bun run harness:health` | root / one_shot | - | n/a | exit_zero | Run the active observability profile health check, if one is configured. |
| `bun run harness:logs --query <text>` | root / one_shot | - | n/a | exit_zero | Search configured observability log files for matching lines. |
| `bun run harness:validate` | root / one_shot | - | n/a | exit_zero | Run the fast local validation suite. |
| `bun run harness:validate:full` | root / one_shot | - | n/a | exit_zero | Run the full validation suite, including harness runtime regression tests. |
| `bun run harness:discover` | root / one_shot | - | n/a | exit_zero | Report discovery status and current question packet. |
| `bun run harness:discover --reset` | root / one_shot | - | n/a | exit_zero | Reset discovery and rewrite the docs back to guided-question mode. |
| `bun run harness:plan` | root / one_shot | post_init_or_discovery_complete, docs_ready, milestones_present | expected_block | exit_zero | Synchronize milestones and tasks after docs become executable. |
| `bun run harness:status --json` | root / one_shot | - | n/a | exit_zero | Render a derived machine-readable summary of the current harness state. |
| `bun run harness:orchestrate` | root / one_shot | planned_backlog, pending_task | expected_block | exit_zero | Prepare the next task contract and handoff artifact. |
| `bun run harness:evaluate --task <id>` | root / one_shot | active_task | expected_block | exit_zero | Evaluate the active task, including structured gates, and write fresh evaluation and handoff artifacts. |
| `bun run harness:self-review --report` | root / one_shot | - | n/a | exit_zero | Run the machine-readable self-review checklist over the current diff and write a review report. |
| `bun run harness:state-recover --list` | root / one_shot | - | n/a | exit_zero | List or recover state snapshots created before state mutations. |
| `bun run harness:unblock --task <id>` | root / one_shot | blocked_task | expected_block | exit_zero | Unblock a stuck task and reset its stall counter. |
| `bun run harness:parallel-dispatch -- --apply` | root / one_shot | planned_backlog, clean_main_worktree, eligible_milestone | expected_block | exit_zero | Allocate milestone worktrees when the backlog and git state allow it. |
| `bun run harness:merge-milestone -- M1` | root / one_shot | active_worktree, clean_main_worktree, milestone_done | expected_block | exit_zero | Merge a completed milestone branch back into the main worktree. |
| `bun run harness:compact` | root / one_shot | - | n/a | exit_zero | Write a concise repository-owned compact snapshot from state and task artifacts. |
| `bun run harness:guardian --mode preflight` | root / one_shot | - | n/a | exit_zero | Run repo-owned guardrails for preflight, stop, or drift checks. |
| `bun run harness:dispatch --prepare --role sidecar` | root / one_shot | - | n/a | exit_zero | Prepare or complete a provider-neutral dispatch packet/result artifact. |
| `bun run build` | root / one_shot | bun_install | expected_block | exit_zero | Build all workspaces through Turbo. |
| `bun run dev` | root / persistent | bun_install | expected_block | persistent_boot | Start all workspace dev processes in parallel. |
| `bun run lint` | root / one_shot | bun_install | expected_block | exit_zero | Run the root Biome checks and workspace lint scripts. |
| `bun run lint:root` | root / one_shot | bun_install | expected_block | exit_zero | Run repository-wide Biome checks from the root. |
| `bun run lint:biome` | root / one_shot | bun_install | expected_block | exit_zero | Run repository-wide Biome lint rules only. |
| `bun run typecheck` | root / one_shot | bun_install | expected_block | exit_zero | Run root and workspace type checks. |
| `bun run typecheck:root` | root / one_shot | bun_install | expected_block | exit_zero | Run the root TypeScript type check. |
| `bun run test` | root / one_shot | bun_install | expected_block | exit_zero | Run all workspace tests through Turbo. |
| `bun run check` | root / one_shot | bun_install | expected_block | exit_zero | Run the full Biome check against the repository. |
| `bun run format` | root / one_shot | bun_install | expected_block | exit_zero | Rewrite files into the repository's canonical format. |
| `bun run format:check` | root / one_shot | bun_install | expected_block | exit_zero | Verify that repository files already match the canonical format. |

---

## Workspace Commands

| Command | Mode | Requires | Missing Prereq | Success | Summary |
|---------|------|----------|----------------|---------|---------|
| `cd apps/<name> && bun run build` | workspace:app / one_shot | bun_install | expected_block | exit_zero | Build one app workspace. |
| `cd apps/<name> && bun run dev` | workspace:app / persistent | bun_install | expected_block | persistent_boot | Start one app workspace in watch mode. |
| `cd apps/<name> && bun run lint` | workspace:app / one_shot | bun_install | expected_block | exit_zero | Run Biome checks inside one app workspace. |
| `cd apps/<name> && bun run typecheck` | workspace:app / one_shot | bun_install | expected_block | exit_zero | Run TypeScript checks inside one app workspace. |
| `cd apps/<name> && bun run test` | workspace:app / one_shot | bun_install | expected_block | exit_zero | Run tests inside one app workspace. |
| `cd packages/<name> && bun run build` | workspace:package / one_shot | bun_install | expected_block | exit_zero | Build one package workspace. |
| `cd packages/<name> && bun run lint` | workspace:package / one_shot | bun_install | expected_block | exit_zero | Run Biome checks inside one package workspace. |
| `cd packages/<name> && bun run typecheck` | workspace:package / one_shot | bun_install | expected_block | exit_zero | Run TypeScript checks inside one package workspace. |
| `cd packages/<name> && bun run test` | workspace:package / one_shot | bun_install | expected_block | exit_zero | Run tests inside one package workspace. |

