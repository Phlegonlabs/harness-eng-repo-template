import path from “node:path”;
import { writeFileSync } from “node:fs”;
import type {
  DiscoveryAnswerBatch,
  DiscoveryQuestionPacket,
  DiscoveryReadiness,
  DiscoveryState,
  HarnessState
} from “./types”;
import { repoRoot } from “./shared”;
import { loadState, saveState } from “./planning”;
import {
  PRD_QUESTIONS,
  ARCHITECTURE_QUESTIONS,
  PRD_PACKETS,
  ARCH_PACKETS,
  REQUIRED_PRD,
  REQUIRED_ARCH
} from “./discovery-questions”;

function questionMap(): Record<string, DiscoveryQuestion> {
  return Object.fromEntries([...PRD_QUESTIONS, ...ARCHITECTURE_QUESTIONS].map((question) => [question.id, question]));
}

function hasValue(answered: Record<string, string>, id: string): boolean {
  return Boolean(answered[id] && answered[id].trim());
}

export function evaluateDiscoveryReadiness(answered: Record<string, string>): DiscoveryReadiness {
  const productReady = REQUIRED_PRD.every((id) => hasValue(answered, id));
  const architectureReady = REQUIRED_ARCH.every((id) => hasValue(answered, id));
  return {
    productReady,
    architectureReady,
    planReady: productReady && architectureReady
  };
}

function currentStage(readiness: DiscoveryReadiness): DiscoveryState["stage"] {
  if (!readiness.productReady) return "PRD";
  if (!readiness.architectureReady) return "ARCHITECTURE";
  return "COMPLETE";
}

function selectPacket(answered: Record<string, string>, packets: string[][], stage: "PRD" | "ARCHITECTURE"): DiscoveryQuestionPacket | null {
  const map = questionMap();
  for (const packetIds of packets) {
    const unanswered = packetIds.filter((id) => !hasValue(answered, id));
    if (unanswered.length === 0) continue;
    return {
      stage,
      questionIds: unanswered,
      questions: unanswered.map((id) => map[id]),
      completionCriteria: evaluateDiscoveryReadiness(answered)
    };
  }
  return null;
}

export function nextDiscoveryPacket(state: HarnessState): DiscoveryQuestionPacket | null {
  const readiness = evaluateDiscoveryReadiness(state.discovery.answered);
  if (!readiness.productReady) {
    return selectPacket(state.discovery.answered, PRD_PACKETS, "PRD");
  }
  if (!readiness.architectureReady) {
    return selectPacket(state.discovery.answered, ARCH_PACKETS, "ARCHITECTURE");
  }
  return null;
}

function sectionValue(answered: Record<string, string>, id: string, fallback: string): string {
  return hasValue(answered, id) ? answered[id].trim() : fallback;
}

export function renderProductDoc(answered: Record<string, string>): string {
  return [
    "# Product Requirements Document",
    "",
    "> This document is a living spec. Update it when requirements change.",
    "> Agents read this to understand *what* is being built and *why*.",
    "",
    "---",
    "",
    "## Executive Summary",
    "",
    sectionValue(answered, "prd.executive-summary", "**[PROJECT_NAME]** is a [type of product] that helps [target users] to [accomplish goal] by [core mechanism]."),
    "",
    "---",
    "",
    "## Problem Statement",
    "",
    sectionValue(answered, "prd.problem-statement", "**Current state:** [Describe the status quo]\n\n**The gap:** [Describe what's missing or broken]\n\n**Impact:** [Describe consequences of the gap — lost time, revenue, user frustration, etc.]"),
    "",
    "---",
    "",
    "## Target Audience",
    "",
    sectionValue(answered, "prd.target-audience", "| Persona | Description | Primary Goal |\n|---------|-------------|--------------|\n| [Persona 1] | [Description] | [Goal] |\n| [Persona 2] | [Description] | [Goal] |"),
    "",
    "---",
    "",
    "## Core Capabilities",
    "",
    sectionValue(answered, "prd.core-capabilities", "### Must Have (v1)\n- [ ] [Capability 1]\n- [ ] [Capability 2]\n\n### Should Have (v1)\n- [ ] [Capability 3]\n\n### Could Have (later)\n- [ ] [Capability 4]\n\n### Won't Have (out of scope)\n- [Explicitly excluded thing]"),
    "",
    "---",
    "",
    "## Proposed Milestones",
    "",
    sectionValue(answered, "prd.proposed-milestones", "- [ ] [Milestone 1] — [Goal / shipped outcome]\n- [ ] [Milestone 2] — [Goal / shipped outcome]"),
    "",
    "---",
    "",
    "## Scope Boundaries",
    "",
    sectionValue(answered, "prd.scope-boundaries", "**In scope:**\n- [What is explicitly included]\n\n**Out of scope:**\n- [What is explicitly excluded and why]"),
    "",
    "---",
    "",
    "## Success Metrics",
    "",
    sectionValue(answered, "prd.success-metrics", "| Metric | Baseline | Target | Timeline |\n|--------|----------|--------|----------|\n| [Metric 1] | [Current] | [Goal] | [When] |\n| [Metric 2] | [Current] | [Goal] | [When] |"),
    "",
    "---",
    "",
    "## Assumptions & Constraints",
    "",
    sectionValue(answered, "prd.assumptions-constraints", "**Assumptions:**\n- [Assumption 1]\n- [Assumption 2]\n\n**Constraints:**\n- [Technical constraint]\n- [Resource constraint]\n- [Timeline constraint]"),
    "",
    "---",
    "",
    "## Open Questions",
    "",
    sectionValue(answered, "prd.open-questions", "- [ ] [Question 1] — *Owner: [name], Due: [date]*\n- [ ] [Question 2] — *Owner: [name], Due: [date]*"),
    "",
    "---",
    "",
    "## Planning Readiness Checklist",
    "",
    `- [${hasValue(answered, "prd.executive-summary") ? "x" : " "}] Product goals are explicit`,
    `- [${hasValue(answered, "prd.scope-boundaries") ? "x" : " "}] In-scope vs out-of-scope is explicit`,
    `- [${hasValue(answered, "prd.success-metrics") ? "x" : " "}] Success metrics are explicit`,
    `- [${hasValue(answered, "prd.proposed-milestones") ? "x" : " "}] Proposed milestones are listed`,
    `- [${hasValue(answered, "prd.problem-statement") ? "x" : " "}] No critical unknown blocks architecture work`,
    "",
    "---",
    "",
    "*Last updated: [date] | Owner: [name]*"
  ].join("\n");
}

export function renderArchitectureDoc(answered: Record<string, string>): string {
  return [
    "# System Architecture",
    "",
    "> This document describes *how* the system is structured, not *what* it does (that's `product.md`).",
    "> Agents read this to understand constraints before implementing.",
    "",
    "---",
    "",
    "## Architecture Overview",
    "",
    sectionValue(answered, "arch.overview", "```\n[User / Client]\n       │\n       ▼\n  ┌─────────┐\n  │   UI    │\n  └────┬────┘\n       │\n  ┌────▼────┐\n  │ Service │\n  └────┬────┘\n       │\n  ┌────▼────┐\n  │  Repo   │\n  └────┬────┘\n       │\n  ┌────▼────┐\n  │ Config  │\n  └────┬────┘\n       │\n  ┌────▼────┐\n  │  Types  │\n  └─────────┘\n```"),
    "",
    "---",
    "",
    "## Dependency Layer Model",
    "",
    "This project enforces a strict dependency layer order. See `harness/rules/dependency-layers.json` for machine-readable rules.",
    "",
    "```",
    "Types → Config → Repo → Service → Runtime → UI",
    "```",
    "",
    "**Rule:** Each layer may only import from layers below (to the left) of it.",
    "**Enforcement:** `bun run harness:lint` checks this on every commit.",
    "",
    "| Layer | Directory | Allowed Imports |",
    "|-------|-----------|-----------------|",
    "| `types` | `src/types/` | (none — foundational) |",
    "| `config` | `src/config/` | `types` |",
    "| `repo` | `src/repo/` | `types`, `config` |",
    "| `service` | `src/service/` | `types`, `config`, `repo` |",
    "| `runtime` | `src/runtime/` | `types`, `config`, `repo`, `service` |",
    "| `ui` | `src/ui/` | all layers |",
    "",
    "---",
    "",
    "## System Boundaries",
    "",
    sectionValue(answered, "arch.system-boundaries", "| System | Direction | Protocol | Notes |\n|--------|-----------|----------|-------|\n| [External system 1] | inbound | [HTTP/gRPC/etc] | [notes] |\n| [External system 2] | outbound | [HTTP/gRPC/etc] | [notes] |"),
    "",
    "---",
    "",
    "## Interfaces & Contracts",
    "",
    sectionValue(answered, "arch.interfaces-contracts", "### [Interface 1]\n```\n[Schema or API signature]\n```"),
    "",
    "---",
    "",
    "## Execution Constraints",
    "",
    sectionValue(answered, "arch.execution-constraints", "| Constraint | Impact on Milestones | Notes |\n|-----------|----------------------|-------|\n| [Shared migration / external dependency / lock] | [Why it blocks or serializes work] | [notes] |"),
    "",
    "---",
    "",
    "## Cross-Cutting Concerns",
    "",
    sectionValue(answered, "arch.cross-cutting", "| Concern | Approach |\n|---------|----------|\n| **Logging** | Structured JSON logs, no `console.log` in production |\n| **Error handling** | Errors typed at system boundaries, propagate as values inside |\n| **Authentication** | [Your approach] |\n| **Configuration** | Environment variables via `.env`, validated at startup |"),
    "",
    "---",
    "",
    "## Build / Distribution / Deployment",
    "",
    sectionValue(answered, "arch.build-distribution-deployment", "```bash\n# Build\n[your build command]\n\n# Test\n[your test command]\n\n# Deploy\n[your deploy command]\n```"),
    "",
    "---",
    "",
    "## Technical Risks",
    "",
    sectionValue(answered, "arch.technical-risks", "| Risk | Likelihood | Impact | Mitigation |\n|------|-----------|--------|------------|\n| [Risk 1] | High/Med/Low | High/Med/Low | [Mitigation] |"),
    "",
    "---",
    "",
    "## Validation Plan",
    "",
    sectionValue(answered, "arch.validation-plan", "1. `bun run harness:structural` — structural compliance\n2. `bun run harness:lint` — linting and rule checks\n3. `bun run harness:validate` — full harness validation"),
    "",
    "---",
    "",
    "## Architecture Readiness Checklist",
    "",
    `- [${hasValue(answered, "arch.system-boundaries") ? "x" : " "}] System boundaries are explicit`,
    `- [${hasValue(answered, "arch.overview") ? "x" : " "}] Dependency direction is explicit`,
    `- [${hasValue(answered, "arch.interfaces-contracts") ? "x" : " "}] Interfaces/contracts are explicit enough to implement`,
    `- [${hasValue(answered, "arch.execution-constraints") ? "x" : " "}] Execution constraints for milestone splitting are explicit`,
    `- [${hasValue(answered, "arch.validation-plan") ? "x" : " "}] No critical architecture unknown blocks backlog generation`,
    "",
    "---",
    "",
    "*Last updated: [date] | Owner: [name]*"
  ].join("\n");
}

function writeDiscoveryProgressDoc(root: string, state: HarnessState): void {
  const readiness = state.discovery.readiness;
  const nextPacket = nextDiscoveryPacket(state);
  const stage = state.discovery.stage;
  const progress = [
    "# Delivery Progress",
    "",
    "> Milestones and tasks are generated only after `docs/product.md` and `docs/architecture.md`",
    "> are complete enough to execute. This file is the human review surface; `.harness/state.json`",
    "> is the machine state canon.",
    "",
    "---",
    "",
    "## Planning Status",
    "",
    "| Surface | Status | Notes |",
    "|--------|--------|-------|",
    `| \`docs/product.md\` | ${readiness.productReady ? "Ready" : "Draft"} | ${readiness.productReady ? "PRD is complete enough to execute" : "Discovery is still filling PRD sections"} |`,
    `| \`docs/architecture.md\` | ${readiness.architectureReady ? "Ready" : "Draft"} | ${readiness.architectureReady ? "Architecture is complete enough to execute" : "Architecture questions have not completed yet"} |`,
    `| Discovery | ${stage} | ${nextPacket ? `Next questions: ${nextPacket.questionIds.join(", ")}` : "Discovery complete" } |`,
    `| Backlog sync | ${readiness.planReady ? "Ready" : "Blocked"} | ${readiness.planReady ? "Run \`bun run harness:plan\`" : "Finish discovery before planning"} |`,
    "",
    "---",
    "",
    "## Milestones",
    "",
    "| Milestone | Goal | Status | Depends On | Parallel | Worktree |",
    "|-----------|------|--------|------------|----------|----------|",
    "| *(generated by `harness:plan`)* | - | - | - | - | - |",
    "",
    "---",
    "",
    "## Tasks",
    "",
    "| Task | Milestone | Kind | Status | Validation | Notes |",
    "|------|-----------|------|--------|------------|-------|",
    "| *(generated by `harness:plan`)* | - | - | - | - | - |",
    "",
    "---",
    "",
    "## Active Worktrees",
    "",
    "| Worktree | Milestone | Branch | Status |",
    "|----------|-----------|--------|--------|",
    "| *(created by `harness:parallel-dispatch` when milestone parallelism is enabled)* | - | - | - |",
    "",
    "---",
    "",
    "## Activity Log",
    "",
    `- Discovery updated on ${state.discovery.lastUpdatedAt ?? "[date]"}.`
  ].join("\n");

  writeFileSync(path.join(root, "docs/progress.md"), `${progress}\n`);
}

export function resetDiscoveryState(state: HarnessState): HarnessState {
  state.discovery = {
    stage: "PRD",
    status: "idle",
    currentQuestionIds: [],
    answered: {},
    history: [],
    readiness: {
      productReady: false,
      architectureReady: false,
      planReady: false
    },
    lastUpdatedAt: null
  };
  state.planning.phase = "DISCOVERY";
  state.planning.docsReady = {
    product: false,
    architecture: false,
    backlog: false
  };
  state.milestones = [];
  state.tasks = [];
  state.execution.activeMilestones = [];
  state.execution.activeWorktrees = [];
  state.skills.loaded = [];
  return state;
}

export function applyDiscoveryAnswers(root: string, batch: DiscoveryAnswerBatch): HarnessState {
  const state = loadState(root);
  for (const answer of batch.answers) {
    state.discovery.answered[answer.id] = answer.value.trim();
  }

  const readiness = evaluateDiscoveryReadiness(state.discovery.answered);
  state.discovery.readiness = readiness;
  state.discovery.stage = currentStage(readiness);
  state.discovery.status = readiness.planReady ? "ready_for_plan" : "collecting";
  state.discovery.history.push({
    stage: state.discovery.stage,
    questionIds: batch.answers.map((answer) => answer.id),
    answeredAt: new Date().toISOString()
  });
  state.discovery.lastUpdatedAt = new Date().toISOString();

  const nextPacket = nextDiscoveryPacket(state);
  state.discovery.currentQuestionIds = nextPacket?.questionIds ?? [];
  state.planning.docsReady = {
    product: readiness.productReady,
    architecture: readiness.architectureReady,
    backlog: readiness.planReady
  };

  writeFileSync(path.join(root, "docs/product.md"), `${renderProductDoc(state.discovery.answered)}\n`);
  writeFileSync(path.join(root, "docs/architecture.md"), `${renderArchitectureDoc(state.discovery.answered)}\n`);
  writeDiscoveryProgressDoc(root, state);
  saveState(root, state);
  return state;
}

export function nextPacketJson(root: string): DiscoveryQuestionPacket | null {
  const state = loadState(root);
  const readiness = evaluateDiscoveryReadiness(state.discovery.answered);
  state.discovery.readiness = readiness;
  state.discovery.stage = currentStage(readiness);
  const packet = nextDiscoveryPacket(state);
  state.discovery.currentQuestionIds = packet?.questionIds ?? [];
  state.discovery.status = readiness.planReady ? "ready_for_plan" : "collecting";
  saveState(root, state);
  return packet;
}

export function resetDiscovery(root: string = repoRoot()): HarnessState {
  const state = resetDiscoveryState(loadState(root));
  writeFileSync(path.join(root, "docs/product.md"), `${renderProductDoc({})}\n`);
  writeFileSync(path.join(root, "docs/architecture.md"), `${renderArchitectureDoc({})}\n`);
  writeDiscoveryProgressDoc(root, state);
  saveState(root, state);
  return state;
}
