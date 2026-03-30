# Quality Grades

Tracks the quality of the engineer template itself. Replace these entries with product-specific grades as the repository is adopted.

**Last updated:** 2026-03-30 | **Updated by:** Project leads

---

## Grading Scale

| Grade | Meaning |
|-------|---------|
| **A** | Production-ready, well-tested, well-documented |
| **B** | Functional, some gaps in tests or docs |
| **C** | Works but needs attention (tech debt, missing tests) |
| **D** | Fragile, known issues, needs refactor |
| **F** | Broken or severely degraded |

---

## Domain Grades

| Domain | Code Quality | Test Coverage | Documentation | Overall | Notes |
|--------|-------------|---------------|---------------|---------|-------|
| Harness runtime | A | B | A | A- | Validation and orchestration flows are live and repo-owned |
| Workspace scaffold | B | B | B | B | Apps and packages are intentionally minimal but ready to customize |
| Documentation surfaces | B | n/a | B | B | Docs are actionable defaults and should be replaced with project context after initialization |

---

## Layer Grades

| Layer | Grade | Coverage | Notes |
|-------|-------|----------|-------|
| Types | B | Minimal scaffold coverage | Shared contracts exist and should be expanded by the first product slice |
| Config | B | Convention coverage | Environment patterns are documented but product validation is still project-specific |
| Repo | B | Structural coverage | Repository layer rules exist even when feature-specific repositories are not yet implemented |
| Service | B | Scaffold tests | Shared service example and rules are present |
| Runtime | B | Scaffold tests | App runtime workspaces compile and test successfully |
| UI | B | Scaffold tests | UI workspace is intentionally thin and awaits product-specific components |

---

## Action Items

Items that need to be addressed to improve grades:

- [ ] Replace template-specific goals, milestones, and grades with project-specific ones during adoption.
- [ ] Add product-specific deployment and runtime checks once target environments are chosen.

---

## How to Update

When a domain or layer grade changes:

1. Update the table above.
2. Add specific action items for anything below B.
3. Create ADRs for significant architectural decisions that affected the grade.
4. Run `bun run harness:entropy` to check for pattern drift.

Entropy scans run weekly (via `.github/workflows/harness-validate.yml`) and may surface issues to address here.
