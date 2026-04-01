# Harness Engineering Repo Template

![Template Ready](https://img.shields.io/badge/template-ready-brightgreen)
![Bun](https://img.shields.io/badge/runtime-bun-black)
![Turbo](https://img.shields.io/badge/monorepo-turbo-blue)
![Agent First](https://img.shields.io/badge/workflow-agent--first-purple)
![Codex + Claude](https://img.shields.io/badge/agents-codex%20%2B%20claude-orange)

An agent-first Bun + Turbo monorepo template for teams that want a repository to be readable by humans, executable by agents, and strict about validation from day one.

## What You Get

- A working monorepo scaffold with `apps/web`, `apps/api`, and `packages/shared`
- Repo-owned workflow commands for planning, orchestration, evaluation, recovery, and validation
- Structured evaluation gates, machine-readable self-review, docs checks, and quality scoring
- Machine-readable engineering rules under `harness/rules/`
- Self-contained agent entry docs in `AGENTS.md`, `CODEX.md`, and `CLAUDE.md`
- Optional canonical design-context surfaces under `docs/design/` for design systems, components, and wireframes
- A repo-owned `harness:context:sync` command for normalizing external product, architecture, and design inputs
- A clean pre-init baseline that becomes project-specific through `harness:init`
- CI-ready validation through `bun run harness:validate:full`

## Who This Is For

- Teams using Codex, Claude Code, or similar coding agents as primary implementers
- Founding or platform engineers who want a reusable repo baseline instead of rebuilding scaffolding
- Projects that want architecture, planning, and validation to live in the repository rather than in chat history

## Template Workflow

The template assumes this split:

- Humans define product intent, architecture decisions, and final approvals
- Agents perform planning, implementation, testing, evaluation, and handoff work
- The repository provides the durable memory and enforcement layer

The canonical repo surfaces are:

- `AGENTS.md`: primary operating contract for agents
- `docs/product.md`: product canon
- `docs/architecture.md`: architecture canon
- `docs/design/`: optional frontend design canon
- `docs/progress.md`: human-readable execution view
- `.harness/state.json`: machine-readable execution state

## Quick Start

Use GitHub's `Use this template` button when possible. A downloaded ZIP also works.

```bash
git clone <this-repo> my-project
cd my-project
bun install
bun run harness:init -- my-project --profile fullstack
bun run harness:status --json
bun run harness:validate
```

If you want CODEOWNERS personalized during init:

```bash
bun run harness:init -- my-project --profile fullstack --owner @acme/engineering
```

After initialization:

1. Update [`docs/product.md`](docs/product.md)
2. Update [`docs/architecture.md`](docs/architecture.md)
3. If your source material lives outside the repo, sync it in with `bun run harness:context:sync`
4. Run `bun run harness:plan`
5. Use `bun run harness:orchestrate` and `bun run harness:evaluate --task <id> --all` to drive execution

## Pre-Init vs Post-Init

Before `harness:init`, this repository is intentionally a template scaffold:

- `bun run harness:doctor` should pass with a warning that the repo is still using the default template identity
- `bun run harness:validate` should pass
- `bun run harness:discover --reset` is available if you want guided PRD/architecture discovery
- `bun run harness:plan` and active task execution are not the normal first step yet

After `harness:init`, the repository becomes your project baseline:

- Package names, docs, and identity surfaces are personalized
- The ready-state docs support planning immediately
- Validation checks look for leftover template identity leaks

## Profiles

Choose the profile that matches the project shape:

| Profile | Intended Use | Layers |
|---------|--------------|--------|
| `fullstack` | Typical web/app product with runtime and UI | `types`, `config`, `repo`, `service`, `runtime`, `ui` |
| `api` | API or backend service without UI by default | `types`, `config`, `repo`, `service`, `runtime` |
| `cli` | CLI-focused project | `types`, `config`, `service`, `runtime` |
| `library` | Shared library / SDK style project | `types`, `config`, `service` |

## Repository Layout

```text
.
├── apps/
│   ├── api/
│   └── web/
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

## Key Commands

### Setup and State

- `bun run harness:init -- <name> --profile <profile>`: personalize the template
- `bun run harness:doctor`: repository health check
- `bun run harness:status --json`: machine-readable state summary
- `bun run harness:compact`: write a concise repo-owned handoff snapshot
- `bun run harness:state-recover --list`: inspect state snapshots
- `bun run harness:state-recover --recommended`: restore the recommended rollback snapshot

### Planning and Execution

- `bun run harness:discover --reset`: guided PRD/architecture interview flow
- `bun run harness:context:sync --design-system <path>`: sync local external product, architecture, design, or wireframe inputs into canonical repo surfaces
- `bun run harness:plan`: sync backlog from docs
- `bun run harness:orchestrate`: prepare the next task contract
- `bun run harness:evaluate --task <id> --all`: evaluate an active task through all configured gates
- `bun run harness:evaluate --task <id> --gate <gate-id>`: preview one gate without advancing task lifecycle
- `bun run harness:dispatch --prepare --role sidecar`: prepare a provider-neutral sidecar packet
- `bun run harness:parallel-dispatch -- --apply`: allocate milestone worktrees
- `bun run harness:merge-milestone -- M1`: merge a completed milestone worktree

### Validation

- `bun run harness:validate`: fast local validation
- `bun run harness:validate:full`: CI-equivalent validation, including structural/runtime regression tests
- `bun run harness:self-review --report`: run the machine-readable self-review checklist
- `bun run harness:docs --report`: run docs freshness and link checks
- `bun run harness:quality --score`: compute a repo quality score and write a quality artifact
- `bun run harness:guardian --mode preflight`: task-start guardrails
- `bun run harness:guardian --mode stop`: stop/handoff guardrails
- `bun run harness:guardian --mode drift`: advisory drift checks

### Workspace Checks

- `bun run build`
- `bun run lint`
- `bun run typecheck`
- `bun run test`

Use [`docs/internal/command-surface.md`](docs/internal/command-surface.md) for the full command contract.

## Validation Model

Use the commands this way:

- During normal development: `bun run harness:validate`
- Before merge or release: `bun run harness:validate:full`
- When you need full workspace confidence: `bun run check`, `bun run test`, `bun run harness:validate:full`

`harness:validate` runs:

1. `harness:doctor`
2. harness linters, including docs freshness
3. required-files / architecture / template-identity / doc-link checks
4. entropy scans and golden-principle checks

## What You Should Customize

After creating a project from this template, replace these first:

- `docs/product.md`
- `docs/architecture.md`
- `docs/design/overview.md`, `docs/design/design-system.md`, and `docs/design/components.md` when the project has UI constraints
- `docs/progress.md` after planning begins
- `.env.example` with project-specific environment variables
- `.github/CODEOWNERS` if you did not set `--owner` during init
- CI/deployment surfaces once your runtime target is known

## Agent Usage

The intended default loop is:

```bash
bun run harness:status --json
bun run harness:guardian --mode preflight
bun run harness:orchestrate
# implement the task
bun run harness:evaluate --task <id> --all
bun run harness:self-review --report
bun run harness:docs --report
bun run harness:quality --score
```

For long-running work, the repo stores contracts, handoffs, compact snapshots, guardian artifacts, and state recovery snapshots under `.harness/`, and `status --json` plus `state-recover --recommended` expose the strongest repo-owned recovery points.

## Included Rules

The template ships machine-readable rules for:

- dependency layers
- file size limits
- forbidden patterns
- naming conventions
- review checklist items
- golden principles
- docs freshness rules
- quality dimensions
- observability profiles

Those live under `harness/rules/` and are consumed by the runtime rather than treated as doc-only guidance.

## More References

- [`docs/glossary.md`](docs/glossary.md): shared repository terminology
- [`docs/internal/operator-guide.md`](docs/internal/operator-guide.md): human operator workflow notes
- [`docs/decisions/000-template.md`](docs/decisions/000-template.md): starter ADR template

## Notes

- The untouched template intentionally warns in `harness:doctor` until you run `harness:init`
- The repository is the durable memory; record important decisions in `docs/`
- If a change spans multiple phases, create an execution plan under `docs/execution-plans/`
- If you want to evaluate the template itself, use the tasks under `evals/tasks/`
