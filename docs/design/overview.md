# Design Context

This directory is the canonical design-context surface for frontend work.

Use it to store the normalized design inputs that implementation agents should follow:

- `design-system.md` for tokens, typography, spacing, motion, and visual language
- `components.md` for reusable component rules, composition patterns, and prop conventions
- `wireframes/` for screenshots, low-fidelity mockups, annotated references, and markdown notes

When the source material lives outside this repository, sync it into these files first:

```bash
bun run harness:context:sync --design-system <path>
bun run harness:context:sync --components <path>
bun run harness:context:sync --wireframes <path>
```

Keep these files lightweight but explicit. If a design decision matters to future agents, write it here instead of leaving it in chat or an external tool only.
