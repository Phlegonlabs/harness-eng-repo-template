import { readFileSync } from "node:fs";
import path from "node:path";
import { defaultCommandSurface, normalizeTaskRecord } from "./planning-state";
import { hasPlaceholderContent, readJson, writeJson } from "./shared";
import { createStateSnapshot } from "./state-recovery";
import { baselineDiscoveryAnswers } from "./template-baseline";
import type { DiscoveryState, HarnessState, MilestoneRecord } from "./types";

export function planningReadiness(root: string): {
	productReady: boolean;
	architectureReady: boolean;
	milestones: MilestoneRecord[];
} {
	const productPath = path.join(root, "docs/product.md");
	const architecturePath = path.join(root, "docs/architecture.md");
	return {
		productReady: !hasPlaceholderContent(productPath),
		architectureReady: !hasPlaceholderContent(architecturePath),
		milestones: milestonesFromProductDoc(productPath),
	};
}

export function milestonesFromProductDoc(
	productPath: string,
): MilestoneRecord[] {
	const content = readFileSync(productPath, "utf8");
	const sections = content.split(/(?=^## )/m);
	const milestoneSection = sections.find((s) =>
		s.startsWith("## Proposed Milestones"),
	);
	if (!milestoneSection) return [];
	const body = milestoneSection.replace(/^## Proposed Milestones\s*/, "");

	const milestones: MilestoneRecord[] = [];
	let index = 1;
	let current: MilestoneRecord | null = null;

	for (const line of body.split(/\r?\n/)) {
		// Top-level bullet: milestone (no leading whitespace before -)
		const topMatch = line.match(/^-\s+(?:\[ \]\s+)?(.+?)\s*$/);
		if (topMatch) {
			const title = topMatch[1].trim();
			if (!title) continue;
			current = {
				id: `M${index}`,
				title,
				goal: title,
				status: "planned",
				dependsOn: [],
				parallelEligible: true,
				affectedAreas: [],
				worktreeName: null,
				taskHints: [],
			};
			milestones.push(current);
			index += 1;
			continue;
		}

		// Indented bullet: task hint (2+ spaces before -)
		const subMatch = line.match(/^\s{2,}-\s+(?:\[ \]\s+)?(.+?)\s*$/);
		if (subMatch && current) {
			const hint = subMatch[1].trim();
			if (hint) {
				current.taskHints.push(hint);
			}
		}
	}

	return milestones;
}

export function stateTemplate(projectName: string): HarnessState {
	const answered = baselineDiscoveryAnswers(projectName);
	const discovery: DiscoveryState = {
		stage: "COMPLETE",
		status: "ready_for_plan",
		currentQuestionIds: [],
		answered,
		history: [],
		readiness: {
			productReady: true,
			architectureReady: true,
			planReady: true,
		},
		lastUpdatedAt: new Date().toISOString(),
	};

	return {
		version: "1.0.0",
		projectInfo: {
			projectName,
			harnessLevel: "standard",
			runtime: "bun",
			primaryDocs: {
				product: "docs/product.md",
				architecture: "docs/architecture.md",
				progress: "docs/progress.md",
			},
			commandSurface: defaultCommandSurface(),
		},
		planning: {
			phase: "READY",
			docsReady: {
				product: true,
				architecture: true,
				backlog: true,
			},
			approvals: {
				planApproved: false,
				currentPhaseApproved: false,
			},
		},
		discovery,
		milestones: [],
		tasks: [],
		execution: {
			activeMilestones: [],
			activeWorktrees: [],
			maxParallelMilestones: 2,
		},
		skills: {
			registry: "harness/skills/registry.json",
			progressiveDisclosure: true,
			loaded: [],
			selectionReasons: {},
		},
		compact: {
			latestJsonPath: null,
			latestMarkdownPath: null,
			lastRunAt: null,
			latestSourceEvent: null,
		},
		guardians: {
			preflight: {
				status: "idle",
				runAt: null,
				logPath: null,
				artifactPath: null,
				sourceEvent: null,
				summary: [],
			},
			stop: {
				status: "idle",
				runAt: null,
				logPath: null,
				artifactPath: null,
				sourceEvent: null,
				summary: [],
			},
			drift: {
				status: "idle",
				runAt: null,
				logPath: null,
				artifactPath: null,
				sourceEvent: null,
				summary: [],
			},
		},
		entropy: {
			baselines: {},
			latestDelta: null,
		},
		dispatch: {
			queuedSidecars: [],
			latestPacketPath: null,
			latestResultPath: null,
		},
	};
}

export function loadState(root: string): HarnessState {
	const state = readJson<Partial<HarnessState>>(
		path.join(root, ".harness/state.json"),
	);
	if (!state.discovery) {
		const fallback = {
			...(state as HarnessState),
			discovery: stateTemplate(
				state.projectInfo?.projectName ?? "harness-template",
			).discovery,
		};
		fallback.tasks = (fallback.tasks ?? []).map(normalizeTaskRecord);
		fallback.projectInfo.commandSurface = defaultCommandSurface(root);
		fallback.skills.selectionReasons = fallback.skills.selectionReasons ?? {};
		fallback.compact = fallback.compact ?? {
			latestJsonPath: null,
			latestMarkdownPath: null,
			lastRunAt: null,
			latestSourceEvent: null,
		};
		fallback.guardians =
			fallback.guardians ??
			stateTemplate(fallback.projectInfo?.projectName ?? "harness-template")
				.guardians;
		fallback.entropy = fallback.entropy ?? { baselines: {}, latestDelta: null };
		fallback.dispatch = fallback.dispatch ?? {
			queuedSidecars: [],
			latestPacketPath: null,
			latestResultPath: null,
		};
		return fallback;
	}
	const normalized = state as HarnessState;
	normalized.tasks = (normalized.tasks ?? []).map(normalizeTaskRecord);
	normalized.projectInfo.commandSurface = defaultCommandSurface(root);
	normalized.skills.selectionReasons = normalized.skills.selectionReasons ?? {};
	normalized.compact = normalized.compact ?? {
		latestJsonPath: null,
		latestMarkdownPath: null,
		lastRunAt: null,
		latestSourceEvent: null,
	};
	normalized.guardians =
		normalized.guardians ??
		stateTemplate(normalized.projectInfo.projectName).guardians;
	normalized.entropy = normalized.entropy ?? {
		baselines: {},
		latestDelta: null,
	};
	normalized.dispatch = normalized.dispatch ?? {
		queuedSidecars: [],
		latestPacketPath: null,
		latestResultPath: null,
	};
	return normalized;
}

export function saveState(root: string, state: HarnessState): void {
	createStateSnapshot(root, "pre-save");
	writeJson(path.join(root, ".harness/state.json"), state);
}

export { writeProgressDoc } from "./planning-progress";
