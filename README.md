# Harness Engineering Repo Template

An agent-first repository template for teams using Codex, Claude Code, and similar coding agents as the primary executors of planning, implementation, testing, and handoff work.

This template gives you:

- a Bun + Turbo monorepo scaffold
- machine-readable engineering rules in `harness/rules/`
- a contract-driven task loop with orchestrate/evaluate artifacts
- self-contained agent entry docs
- deterministic repo validation
- reusable eval scaffolding for testing the template itself

---

## What This Template Optimizes For

The template is built around one assumption:

> agents do most of the execution; humans shape the environment, review results, and make final decisions

That changes what matters in a repo. Instead of relying on tribal knowledge and chat context, the repository needs to be easy for agents to read, hard for them to damage, and explicit about what counts as done.

This template encodes that through:

- `AGENTS.md` as the primary self-contained agent entry point
- `CLAUDE.md` and `CODEX.md` as thin tool adapters
- `.harness/state.json` as machine-owned execution state
- `bun run harness:status --json` as the structured current-state surface
- `bun run harness:validate` as the default local validation gate

---

## Template Features

### Agent-first command loop

The default execution loop is:

```bash
bun run harness:status --json
bun run harness:compact
bun run harness:guardian --mode preflight
bun run harness:orchestrate
# implement the task
bun run harness:evaluate --task <id>
```

This produces contracts, evaluation artifacts, handoff checkpoints, and a repo-owned compact snapshot under `.harness/`.

### State hardening and recovery

State writes are hardened and snapshotted automatically.

Use:

```bash
bun run harness:state-recover --list
bun run harness:state-recover --latest
```

Snapshots live under `.harness/snapshots/`.

### Profile-aware initialization

The template supports multiple layer profiles at init time:

```bash
bun run harness:init -- my-project --profile fullstack
bun run harness:init -- my-project --profile api
bun run harness:init -- my-project --profile cli
bun run harness:init -- my-project --profile library
```

Profiles adjust `harness/config.json` and the machine-readable dependency rules for the initialized project.

### Machine-readable rules

Repository rules are encoded in JSON so both agents and runtime checks consume the same contract:

| File | Purpose |
|------|---------|
| `harness/rules/dependency-layers.json` | import direction and layer coverage |
| `harness/rules/file-size-limits.json` | source, test, and doc file limits |
| `harness/rules/forbidden-patterns.json` | banned patterns such as secrets and dead code |
| `harness/rules/naming-conventions.json` | file naming rules |

### Deterministic validation

Use the fast local gate during development:

```bash
bun run harness:validate
```

This runs:

1. `harness:doctor`
2. harness linters
3. required-files / architecture / template-identity / doc-link checks
4. entropy scans

For the CI-equivalent gate, including structural tests, run:

```bash
bun run harness:validate:full
```

### Built-in eval scaffold

The template includes reusable eval infrastructure in `evals/`. Copy `evals/tasks/example-task.md` to create your own eval tasks.

---

## Default Layout

```text
harness-eng-repo-template/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   └── shared/
├── docs/
│   ├── product.md
│   ├── architecture.md
│   ├── progress.md
│   ├── decisions/
│   ├── execution-plans/
│   └── internal/
├── evals/
├── harness/
│   ├── profiles/
│   ├── rules/
│   └── runtime/
├── .harness/
├── AGENTS.md
├── CLAUDE.md
├── CODEX.md
└── package.json
```

Default workspaces are:

- `apps/web`
- `apps/api`
- `packages/shared`

---

## Dependency Layers

The fullstack profile uses:

```text
Types → Config → Repo → Service → Runtime → UI
```

Each layer may only import from layers to its left.

Profiles can trim that default:

| Profile | Layers |
|---------|--------|
| `fullstack` | `types`, `config`, `repo`, `service`, `runtime`, `ui` |
| `api` | `types`, `config`, `repo`, `service`, `runtime` |
| `cli` | `types`, `config`, `service`, `runtime` |
| `library` | `types`, `config`, `service` |

---

## Quick Start

Use GitHub's **Use this template** button for the cleanest path. A downloaded ZIP works too as long as you extract it into a writable directory before running the init flow.

As cloned, this repository is a **pre-init scaffold**:

- `bun run harness:doctor`, `bun run harness:validate`, `bun run harness:status --json`, and `bun run harness:discover --reset` are meaningful immediately
- `bun run harness:plan`, `harness:orchestrate`, and `harness:evaluate` are not the default starting point until initialization or discovery makes the docs ready

```bash
git clone <this-repo> my-project
cd my-project
bun install
# git hooks install automatically inside git checkouts
# if a local clone is missing them, run: bun run harness:install-hooks

# pick the profile that matches the project
bun run harness:init -- my-project --profile fullstack
# optional: personalize CODEOWNERS and doc ownership surfaces
# bun run harness:init -- my-project --profile fullstack --owner @acme/engineering

# inspect the current state surface
bun run harness:status --json

# run the fast local repository gate
bun run harness:validate
```

After initialization:

1. Update `docs/product.md`
2. Update `docs/architecture.md`
3. Run `bun run harness:plan`
4. Use `harness:orchestrate` and `harness:evaluate` to drive execution

---

## Core Docs

| Surface | Role |
|---------|------|
| `AGENTS.md` | primary agent entry point |
| `CLAUDE.md` | Claude Code adapter |
| `CODEX.md` | Codex adapter |
| `docs/product.md` | product canon |
| `docs/architecture.md` | architecture canon |
| `docs/progress.md` | human-readable execution view |
| `docs/glossary.md` | shared terminology for humans and agents |
| `.harness/state.json` | machine-owned execution state |
| `docs/internal/command-surface.md` | command contract matrix |
| `docs/internal/orchestrator-workflow.md` | expanded task-loop reference |
| `docs/internal/operator-guide.md` | human operator guidance for running the harness |

---

## Commands

| Command | Purpose |
|---------|---------|
| `bun run harness:init -- <name> --profile <profile>` | personalize the template |
| `bun run harness:doctor` | health check |
| `bun run harness:discover --reset` | guided PRD/architecture discovery |
| `bun run harness:plan` | sync backlog from docs |
| `bun run harness:status --json` | machine-readable current-state summary |
| `bun run harness:compact` | write a concise compact snapshot for handoff and resume |
| `bun run harness:guardian --mode <preflight|stop|drift>` | run repo-owned guardrails |
| `bun run harness:dispatch --prepare --role sidecar` | prepare a provider-neutral sidecar packet |
| `bun run harness:orchestrate` | prepare the next task contract |
| `bun run harness:evaluate --task <id>` | record task evaluation and handoff |
| `bun run harness:state-recover --list` | list available state snapshots |
| `bun run harness:state-recover --latest` | restore the latest state snapshot |
| `bun run harness:parallel-dispatch -- --apply` | allocate milestone worktrees |
| `bun run harness:merge-milestone -- M1` | merge a completed milestone worktree |
| `bun run harness:validate` | fast local repository gate |
| `bun run harness:validate:full` | CI-equivalent repository gate, including structural runtime tests |

Use `docs/internal/command-surface.md` for the expanded command matrix.

---

## Architecture Decisions

Record project architecture decisions in `docs/decisions/` using the template at `docs/decisions/000-template.md`.

---

## Validation and Tests

This repo is expected to pass:

```bash
bun run check
bun run test
bun run harness:validate
bun run harness:validate:full
```

The harness runtime has its own regression tests under `harness/runtime/*.test.ts`.

Local commits also enforce Conventional Commits through the installed `commit-msg` hook.

---

## Notes

- The untouched template intentionally warns in `harness:doctor` until you run `harness:init`.
- The untouched template is not an active backlog yet; it becomes execution-ready after `harness:init` or the guided discovery path.
- Important decisions belong in `docs/`, not in chat history.
- If a change spans multiple phases, create an execution plan in `docs/execution-plans/`.
- If you want to evaluate the template itself, use the tasks under `evals/tasks/`.
