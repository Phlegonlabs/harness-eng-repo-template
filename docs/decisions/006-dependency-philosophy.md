# ADR-006: Dependency Selection Philosophy

**Date:** 2026-03-29
**Status:** Accepted
**Deciders:** Project maintainers

---

## Context

Agents can add dependencies quickly, but every new package increases the amount of behavior the repo must trust, understand, and maintain. The template already requires human approval for new external dependencies, but it does not explain how to evaluate whether a dependency is worth adding.

---

## Decision

> We will favor stable, well-documented dependencies with low conceptual overhead, and we will require human approval for every new production dependency.

---

## Rationale

Dependency decisions should be easy for both humans and agents to evaluate.

**Considered alternatives:**
- **Option A (chosen):** Conservative dependency policy with human approval — chosen because it keeps the template understandable and reduces accidental tool sprawl.
- **Option B:** Allow agents to add dependencies whenever implementation is faster — rejected because it optimizes short-term speed while increasing long-term entropy.
- **Option C:** Ban nearly all dependencies — rejected because some integrations are legitimate and worth the trade-off when approved deliberately.

---

## Consequences

### Positive
- Agents have a clear rubric for proposing dependencies.
- The repo stays biased toward boring, inspectable technology.
- Human review stays focused on a smaller set of meaningful dependency decisions.

### Negative / Trade-offs
- Some features will take longer when the team chooses an in-repo implementation over a package.
- Dependency proposals require explicit review and cannot be merged by habit.

### Risks
- Teams may overfit to in-house code when a mature library would be cheaper overall. *Mitigation: document the trade-off explicitly in the proposal or ADR.*

---

## Implementation Notes

- Prefer dependencies with stable APIs, good documentation, and behavior that an agent can understand from source or docs.
- If a package only provides a small helper, prefer implementing the helper in-repo.
- Avoid opaque wrapper libraries that hide behavior the repo still needs to reason about.
- Keep the approval rule in `AGENTS.md` aligned with this ADR.
