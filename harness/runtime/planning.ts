import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { hasPlaceholderContent, readJson, writeJson } from "./shared";
import type {
	DiscoveryState,
	HarnessState,
	MilestoneRecord,
	TaskRecord,
} from "./types";

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
	const match = content.match(
		/^## Proposed Milestones\s*([\s\S]+?)(?=^## |Z)/m,
	);
	if (!match) return [];

	const milestones: MilestoneRecord[] = [];
	let index = 1;
	for (const line of match[1].split(/\r?\n/)) {
		const lineMatch = line.match(/^\s*-\s+(?:\[ \]\s+)?(.+?)\s*$/);
		if (!lineMatch) continue;
		const title = lineMatch[1].trim();
		if (!title) continue;
		milestones.push({
			id: `M${index}`,
			title,
			goal: title,
			status: "planned",
			dependsOn: [],
			parallelEligible: true,
			affectedAreas: [],
			worktreeName: null,
		});
		index += 1;
	}

	return milestones;
}

export function defaultTasks(milestones: MilestoneRecord[]): TaskRecord[] {
	return milestones.flatMap((milestone) => {
		const suffix = milestone.id.slice(1);
		return [
			{
				id: `T${suffix}01`,
				milestoneId: milestone.id,
				title: `Refine milestone design for ${milestone.title}`,
				kind: "research",
				status: "pending",
				dependsOn: [],
				affectedFilesOrAreas: [],
				requiredSkills: ["skills/research/SKILL.md"],
				validationChecks: [],
			},
			{
				id: `T${suffix}02`,
				milestoneId: milestone.id,
				title: `Implement ${milestone.title}`,
				kind: "implementation",
				status: "pending",
				dependsOn: [`T${suffix}01`],
				affectedFilesOrAreas: [],
				requiredSkills: ["skills/implementation/SKILL.md"],
				validationChecks: ["bun run harness:validate"],
			},
			{
				id: `T${suffix}03`,
				milestoneId: milestone.id,
				title: `Validate ${milestone.title}`,
				kind: "testing",
				status: "pending",
				dependsOn: [`T${suffix}02`],
				affectedFilesOrAreas: [],
				requiredSkills: [
					"skills/testing/SKILL.md",
					"skills/code-review/SKILL.md",
				],
				validationChecks: ["bun run harness:validate"],
			},
		];
	});
}

export function stateTemplate(projectName: string): HarnessState {
	const discovery: DiscoveryState = {
		stage: "PRD",
		status: "idle",
		currentQuestionIds: [],
		answered: {},
		history: [],
		readiness: {
			productReady: false,
			architectureReady: false,
			planReady: false,
		},
		lastUpdatedAt: null,
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
			commandSurface: [
				"bun run harness:bootstrap -- <name>",
				"bun run harness:doctor",
				"bun run harness:discover",
				"bun run harness:validate",
				"bun run build",
				"bun run lint",
				"bun run typecheck",
				"bun run test",
				"bun run harness:plan",
				"bun run harness:orchestrate",
				"bun run harness:parallel-dispatch",
				"bun run harness:merge-milestone -- <id>",
			],
		},
		planning: {
			phase: "DISCOVERY",
			docsReady: {
				product: false,
				architecture: false,
				backlog: false,
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
		},
	};
}

export function loadState(root: string): HarnessState {
	const state = readJson<Partial<HarnessState>>(
		path.join(root, ".harness/state.json"),
	);
	if (!state.discovery) {
		return {
			...(state as HarnessState),
			discovery: {
				stage: "PRD",
				status: "idle",
				currentQuestionIds: [],
				answered: {},
				history: [],
				readiness: {
					productReady: false,
					architectureReady: false,
					planReady: false,
				},
				lastUpdatedAt: null,
			},
		};
	}
	return state as HarnessState;
}

export function saveState(root: string, state: HarnessState): void {
	writeJson(path.join(root, ".harness/state.json"), state);
}

export function writeProgressDoc(
	root: string,
	milestones: MilestoneRecord[],
	tasks: TaskRecord[],
): void {
	const progress = [
		"# Delivery Progress",
		"",
		"> Generated from `bun run harness:plan`. Edit the PRD or architecture first,",
		"> then re-run planning to resync milestones and placeholder tasks.",
		"",
		"---",
		"",
		"## Planning Status",
		"",
		"| Surface | Status | Notes |",
		"|--------|--------|-------|",
		"| `docs/product.md` | Ready | PRD is complete enough to execute |",
		"| `docs/architecture.md` | Ready | Architecture is complete enough to execute |",
		"| Backlog sync | Ready | Milestones and tasks are synchronized |",
		"",
		"---",
		"",
		"## Milestones",
		"",
		"| Milestone | Goal | Status | Depends On | Parallel | Worktree |",
		"|-----------|------|--------|------------|----------|----------|",
		...milestones.map(
			(milestone) =>
				`| ${milestone.id} | ${milestone.goal} | ${milestone.status} | ${milestone.dependsOn.join(", ") || "-"} | ${milestone.parallelEligible ? "Yes" : "No"} | ${milestone.worktreeName ?? "-"} |`,
		),
		"",
		"---",
		"",
		"## Tasks",
		"",
		"| Task | Milestone | Kind | Status | Validation | Notes |",
		"|------|-----------|------|--------|------------|-------|",
		...tasks.map(
			(task) =>
				`| ${task.id} | ${task.milestoneId} | ${task.kind} | ${task.status} | ${task.validationChecks.join("<br>") || "-"} | Skills: ${task.requiredSkills.join(", ")} |`,
		),
		"",
		"---",
		"",
		"## Active Worktrees",
		"",
		"| Worktree | Milestone | Branch | Status |",
		"|----------|-----------|--------|--------|",
		"| - | - | - | No active milestone worktrees |",
		"",
		"---",
		"",
		"## Activity Log",
		"",
		`- Planning synchronized on ${new Date().toISOString()}.`,
	].join("\n");

	writeFileSync(path.join(root, "docs/progress.md"), `${progress}\n`);
}
