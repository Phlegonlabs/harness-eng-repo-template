# Product Requirements Document

> This document is a living spec. Update it when requirements change.
> Agents read this to understand *what* is being built and *why*.

---

## Executive Summary

**Harness Template** is an engineer-ready monorepo template that helps product and platform teams start shipping in a Bun + Turbo workspace with built-in validation, planning surfaces, and agent-readable project rules from day one.

---

## Problem Statement

**Current state:** New repositories often start as a loose collection of setup scripts, incomplete docs, and implicit conventions.

**The gap:** Engineers and coding agents lose time rebuilding the same repository scaffolding, guessing architecture rules, and deciding how to organize the first production slice.

**Impact:** Teams spend their early project time on setup churn instead of feature delivery, and quality drifts because the working agreements are not encoded in the repository.

---

## Target Audience

| Persona | Description | Primary Goal |
|---------|-------------|--------------|
| Founding engineer | Starts a new product codebase and needs a production-shaped repo immediately | Land the first vertical slice without rebuilding tooling |
| Platform or tech lead | Standardizes how agents and humans work in the same repository | Provide repeatable structure, validation, and handoff rules |
| Product engineer using agents | Edits application code with AI assistance every day | Work inside a repo whose conventions are obvious and enforceable |

---

## Core Capabilities

### Must Have (v1)
- [ ] Ready-to-edit monorepo layout with `apps/web`, `apps/api`, and `packages/shared`
- [ ] Root validation, guardian, compact, and task orchestration that work immediately after initialization
- [ ] Task contracts, evaluator results, handoff artifacts, and compact snapshots for long-running work
- [ ] Repository-owned docs and rules that agents can follow without extra chat context

### Should Have (v1)
- [ ] Guided discovery flow for teams that want PRD and architecture interviews before implementation
- [ ] Milestone and task planning generated from repository docs
- [ ] Provider-neutral dispatch packet artifacts for sidecar and review workflows

### Could Have (later)
- [ ] Optional deployment presets per application workspace
- [ ] Additional shared package templates for design systems or SDKs

### Won't Have (out of scope)
- One-click product-specific frameworks or business logic beyond the engineering scaffold

---

## Proposed Milestones

- [ ] Customize project identity and ownership surfaces — replace template naming, ownership, and environment defaults for the new repository
  - Update harness/config.json with project name and ownership
  - Replace template placeholders across docs and configs
  - Validate initialization with harness:doctor
- [ ] Implement the first vertical slice — ship one real cross-workspace feature through `apps/*` and `packages/*`
  - Define shared types and contracts in packages/shared
  - Implement API endpoint in apps/api
  - Implement UI integration in apps/web
  - Add cross-workspace integration tests
- [ ] Harden for team delivery — add product-specific validation, deployment, and operational checks
  - Review and tighten validation rules
  - Add deployment configuration
  - Add operational health checks and monitoring
  - Validate end-to-end delivery pipeline

---

## Scope Boundaries

**In scope:**
- A working engineer template with monorepo structure, validation, docs, and planning surfaces
- Minimal application and shared package scaffolds that compile and test
- Optional discovery/orchestration tooling for teams that want a more guided workflow

**Out of scope:**
- Product-specific UI, domain models, or deployment infrastructure
- Framework-specific code generation for every possible stack choice
- Automatic feature implementation beyond the scaffold itself

---

## Success Metrics

| Metric | Baseline | Target | Timeline |
|--------|----------|--------|----------|
| Time from clone to first successful validation | Template setup varies by repo | Under 15 minutes after `bun install` and `bun run harness:init` | First session |
| Time to first project-specific code change | Often delayed by repo setup work | Same session as initialization | First day |
| Repository guardrails active | Inconsistent in ad hoc starters | `build`, `test`, `harness:validate`, and CI `harness:validate:full` all pass in the template baseline | Before first feature branch |

---

## Assumptions & Constraints

**Assumptions:**
- Teams want a strong default repository shape but still need to customize product details quickly
- Bun and git are available in the development environment
- The first shipped work will usually span at least one app workspace and one shared package

**Constraints:**
- The template must stay framework-agnostic at the business-logic level
- Rules must remain repository-owned and executable offline
- The default path must not require discovery interviews before coding can begin

---

## Open Questions

- No template-level blockers. Replace this list with project-specific open questions when the repository is adopted.

---

## Planning Readiness Checklist

- [x] Product goals are explicit
- [x] In-scope vs out-of-scope is explicit
- [x] Success metrics are explicit
- [x] Proposed milestones are listed
- [x] No critical unknown blocks architecture work

---

*Last updated: 2026-03-30 | Owner: Project leads*
