# Skill: Frontend

Use this skill when a task touches `apps/web`, `src/ui/`, pages, components, or user-facing frontend behavior.

## Before You Start

1. Read `docs/architecture.md` for workspace and layer constraints
2. Read `docs/design/overview.md` to understand the canonical design context surfaces
3. Read `docs/design/design-system.md` if it exists and is filled in
4. Read `docs/design/components.md` if it exists and is filled in
5. Check `docs/design/wireframes/` for screenshots, notes, and layout references
6. Fall back to implementation defaults when a design surface is still template-only, but keep the missing context explicit

## Frontend Checklist

- [ ] Reuse existing components before creating new ones
- [ ] Use design-system tokens or equivalent theme variables instead of hardcoded values
- [ ] Keep responsive behavior intentional across mobile and desktop
- [ ] Preserve keyboard access, visible focus, and sensible semantics
- [ ] Handle loading, empty, error, and overflow states
- [ ] Keep UI work inside `src/ui/` unless a lower layer is required

## Design Context Order

Prefer design inputs in this order:

1. Synced wireframes or annotated references in `docs/design/wireframes/`
2. `docs/design/components.md`
3. `docs/design/design-system.md`
4. Existing implementation patterns in `apps/web/src/ui/`

## After Implementation

1. Run workspace frontend checks: `cd apps/web && bun run lint && bun run test && bun run typecheck`
2. Run `bun run harness:validate`
3. Update `docs/design/` when a reusable frontend convention changes
