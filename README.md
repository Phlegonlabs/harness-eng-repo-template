# Harness Engineering Template

A reusable starter kit for **AI agent-first development**, based on [OpenAI's Harness Engineering](https://openai.com/index/harness-engineering/) methodology.

Harness Engineering shifts the engineer's role from writing code to **designing environments, constraints, and feedback loops** that enable AI agents to produce reliable code at scale.

---

## Three Pillars

| Pillar | What It Does | Where It Lives |
|--------|-------------|----------------|
| **Context Engineering** | Docs as agent context — structured knowledge agents can navigate | `docs/`, `AGENTS.md`, `CLAUDE.md` |
| **Architectural Constraints** | Machine-readable rules + linters + structural tests | `harness/rules/`, `harness/linters/`, `harness/structural-tests/` |
| **Entropy Management** | Drift detection, orphan cleanup, consistency scanning | `harness/entropy/` |

---

## Quick Start

```bash
# 1. Clone this template
git clone <this-repo> my-project && cd my-project

# 2. Bootstrap with your project name
./harness/scripts/bootstrap.sh my-project

# 3. Check health
./harness/scripts/doctor.sh

# 4. Run full validation
./harness/scripts/validate.sh
```

---

## Repo Layout

```
.
├── AGENTS.md                  # Universal agent entry point (~100 lines)
├── CLAUDE.md                  # Claude Code specific instructions
├── .claude/
│   └── settings.json          # Agent permissions, hooks, model config
├── docs/                      # Pillar 1: Context Engineering
│   ├── product.md             # Product requirements (fill this in)
│   ├── architecture.md        # System architecture (fill this in)
│   ├── glossary.md            # Project terminology
│   ├── internal/              # Agent & operator guides
│   ├── decisions/             # Architecture Decision Records (ADRs)
│   ├── execution-plans/       # Step-by-step implementation plans
│   └── quality/
│       └── GRADES.md          # Domain & layer quality tracking
├── skills/                    # On-demand knowledge — loaded when needed
│   ├── research/SKILL.md      # Codebase research patterns
│   ├── implementation/SKILL.md # Feature implementation guide
│   ├── testing/SKILL.md       # Testing patterns & rules
│   ├── code-review/SKILL.md   # PR review checklist
│   └── deployment/SKILL.md    # PR & deployment workflow
├── hooks/                     # Claude Code hooks (back-pressure)
│   ├── pre-stop.sh            # Runs before agent stops — enforces quality
│   └── post-stop-notify.sh    # Optional Slack notification
├── evals/                     # Agent performance evaluation
│   ├── run.sh                 # Eval runner
│   └── tasks/                 # Eval task definitions
├── harness/                   # Pillar 2+3: Constraints + Entropy
│   ├── rules/                 # Golden rules as machine-readable JSON
│   ├── linters/               # Custom linters with teaching error messages
│   ├── structural-tests/      # Architecture compliance tests
│   ├── entropy/               # Drift & consistency scans
│   ├── hooks/                 # Git hooks (pre-commit, commit-msg, pre-push)
│   └── scripts/               # bootstrap, doctor, validate, install-hooks
├── .github/                   # CI/CD workflows + PR/issue templates
├── src/                       # Your source code goes here
└── tests/                     # Your tests go here
```

---

## When This Template Fits

**Good fit:**
- New projects where AI agents will write most of the code
- Team projects needing consistent constraints across human + agent contributors
- Any stack (language-agnostic — harness uses shell scripts + jq)

**Less ideal:**
- Large existing codebases without architectural boundaries (retrofitting is costly)
- Solo projects with no recurring agent sessions

---

## Harness Level

This is a **Level 2 Harness** (team-level), covering:
- Individual agent instructions (AGENTS.md, CLAUDE.md)
- Team workflows and conventions
- PR process and CI validation
- Governance templates (ADRs, runbooks)

See [docs/internal/operator-guide.md](docs/internal/operator-guide.md) for day-to-day workflow details.

---

## Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **AGENTS.md / CLAUDE.md** | Agent entry points & project map | Root |
| **skills/** | On-demand knowledge (loaded when needed) | `skills/` |
| **hooks/** | Automated quality gates (back-pressure) | `hooks/` |
| **evals/** | Measure agent effectiveness | `evals/` |
| **harness/rules/** | Golden rules as machine-readable JSON | `harness/rules/` |
| **harness/linters/** | Teaching error messages | `harness/linters/` |
| **harness/structural-tests/** | Enforce architecture mechanically | `harness/structural-tests/` |
| **harness/entropy/** | Drift & consistency detection | `harness/entropy/` |
| **docs/decisions/** | ADRs — record decisions for agent context | `docs/decisions/` |
| **docs/execution-plans/** | Step-by-step guides for complex tasks | `docs/execution-plans/` |
| **docs/quality/GRADES.md** | Track tech debt per domain/layer | `docs/quality/` |

> When something fails, the fix is almost never "try harder." Ask: *what capability is missing, and how do we make it both legible and enforceable for the agent?*

---

## Requirements

- `bash` 4+
- `jq` (for JSON rule parsing — `brew install jq` / `apt install jq`)
- `git`
