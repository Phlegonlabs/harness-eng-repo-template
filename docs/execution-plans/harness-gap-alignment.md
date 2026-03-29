# Harness Gap Alignment

**Status:** In Progress  
**Last updated:** 2026-03-29

---

## Goal

Close the remaining harness-alignment gaps around workspace entry docs, observability, dependency guidance, doc maintenance automation, and self-review ergonomics.

---

## Active Scope

1. Add workspace-level `AGENTS.md` files and enforce them through structural validation.
2. Add a shared structured logger, observability docs, and debugging skill wiring.
3. Record dependency-selection policy in an ADR and link it from the agent entry docs.
4. Scaffold a docs-only maintenance workflow plus prompt template.
5. Add a lightweight `harness:self-review` command and surface it in tool docs.

---

## Verification

- `bun run harness:validate`
- `bun run harness:validate:full`
