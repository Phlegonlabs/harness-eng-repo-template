# Contributing

## For Humans

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make changes and run validation: `./harness/scripts/validate.sh`
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/): `feat(scope): description`
4. Open a PR and fill in the PR template checklist

## For AI Agents

Before any work session, read in this order:

1. `AGENTS.md` or `CLAUDE.md` (your entry point)
2. `docs/internal/agent-entry.md` (canonical rules)
3. `docs/product.md` and `docs/architecture.md` (project context)

Rules:
- Run `./harness/scripts/validate.sh` before handing off
- Follow the dependency layer order (see `harness/rules/dependency-layers.json`)
- Keep files under 500 lines
- No backwards-compat shims or dead code

## Commit Conventions

```
<type>(<scope>): <short description>

Types: feat, fix, docs, refactor, test, chore, harness
Scope: area of the codebase (optional but recommended)

Examples:
  feat(auth): add JWT validation
  fix(api): handle null response from upstream
  harness(linters): tighten file-size rule to 400 lines
  docs(architecture): update service diagram
```

## PR Process

- Every PR must pass `./harness/scripts/validate.sh` in CI
- For agent-submitted PRs, add the `agent-submitted` label
- Reviewers focus on architecture, extensibility, and harness compliance — not style (the linters handle style)
