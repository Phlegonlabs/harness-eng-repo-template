# Quality Grades

Tracks the quality of each product domain and architectural layer.
Update this after significant changes or as part of periodic cleanup passes.

**Last updated:** [date] | **Updated by:** [name/agent]

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
| *(add your domains)* | - | - | - | - | |

---

## Layer Grades

| Layer | Grade | Coverage | Notes |
|-------|-------|----------|-------|
| Types | - | - | |
| Config | - | - | |
| Repo | - | - | |
| Service | - | - | |
| Runtime | - | - | |
| UI | - | - | |

---

## Action Items

Items that need to be addressed to improve grades:

- [ ] [Action item 1] — *Owner: [name], Due: [date]*
- [ ] [Action item 2] — *Owner: [name], Due: [date]*

---

## How to Update

When a domain or layer grade changes:

1. Update the table above
2. Add specific action items for anything below B
3. Create ADRs for significant architectural decisions that affected the grade
4. Run `bun run harness:entropy` to check for pattern drift

Entropy scans run weekly (via `.github/workflows/harness-validate.yml`) and may surface issues to address here.
