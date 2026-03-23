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
├── AGENTS.md              # Universal agent entry point (~100 lines)
├── CLAUDE.md              # Claude Code specific instructions
├── docs/                  # Pillar 1: Context Engineering
│   ├── product.md         # Product requirements (fill this in)
│   ├── architecture.md    # System architecture (fill this in)
│   ├── glossary.md        # Project terminology
│   ├── internal/          # Agent & operator guides
│   └── decisions/         # Architecture Decision Records (ADRs)
├── harness/               # Pillar 2+3: Constraints + Entropy
│   ├── rules/             # Golden rules as machine-readable JSON
│   ├── linters/           # Custom linters with teaching error messages
│   ├── structural-tests/  # Architecture compliance tests
│   ├── entropy/           # Drift & consistency scans
│   ├── hooks/             # Git hooks (pre-commit, commit-msg, pre-push)
│   └── scripts/           # bootstrap, doctor, validate, install-hooks
├── .github/               # CI/CD workflows + PR/issue templates
├── src/                   # Your source code goes here
└── tests/                 # Your tests go here
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

## Requirements

- `bash` 4+
- `jq` (for JSON rule parsing — `brew install jq` / `apt install jq`)
- `git`
