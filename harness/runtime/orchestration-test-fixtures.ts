import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { HarnessState, TaskRecord } from "./types";

const supportFiles: Record<string, string> = {
	"harness/command-surface.json": `${JSON.stringify(
		{
			version: "1.0.0",
			includes: ["harness/command-surface-root.json"],
		},
		null,
		2,
	)}\n`,
	"harness/command-surface-root.json": `${JSON.stringify(
		{
			commands: [
				{
					id: "root.harness-evaluate",
					display: "bun run harness:evaluate --task <id>",
					requires: ["active_task"],
					summary: "Evaluate the active task.",
				},
			],
		},
		null,
		2,
	)}\n`,
	"harness/skills/registry.json": `${JSON.stringify(
		{
			strategy: "test",
			phases: {
				EXECUTING: ["skills/implementation/SKILL.md"],
				VALIDATING: [
					"skills/testing/SKILL.md",
					"skills/code-review/SKILL.md",
					"skills/debugging/SKILL.md",
				],
			},
			taskKinds: {
				implementation: ["skills/implementation/SKILL.md"],
				debugging: ["skills/debugging/SKILL.md"],
			},
			conditions: [
				{
					when: "task.touchesUnknownArea == true",
					load: ["skills/research/SKILL.md"],
				},
				{
					when: "task.requiresValidation == true",
					load: ["skills/testing/SKILL.md"],
				},
				{
					when: "task.involvesBugFix == true",
					load: ["skills/debugging/SKILL.md"],
				},
			],
			routing: {
				maxLoadedSkills: 4,
				preserveRequiredSkills: true,
				weights: {
					"skills/implementation/SKILL.md": 100,
					"skills/research/SKILL.md": 90,
					"skills/testing/SKILL.md": 80,
					"skills/debugging/SKILL.md": 85,
					"skills/code-review/SKILL.md": 70,
				},
				reasonLabels: {
					required: "task-required",
					phase: "phase-match",
					taskKind: "kind-match",
					filePattern: "file-pattern",
				},
			},
			skillMetadata: {
				"skills/implementation/SKILL.md": {
					filePatterns: ["apps/**", "packages/**"],
					guardrails: ["dependency-layers", "file-size-limits"],
				},
				"skills/testing/SKILL.md": {
					filePatterns: ["tests/**", "**/*.test.ts", "**/*.spec.ts"],
					guardrails: ["test-coverage", "test-file-size"],
				},
				"skills/code-review/SKILL.md": {
					filePatterns: ["docs/**", "harness/**"],
					guardrails: ["documentation-sync"],
				},
				"skills/debugging/SKILL.md": {
					filePatterns: ["apps/api/**", "packages/shared/**"],
					guardrails: ["structured-logging"],
				},
			},
			validation: {
				defaultChecksByKind: {
					implementation: ["bun --version"],
					testing: ["bun --version"],
					debugging: ["bun --version"],
					review: ["bun --version"],
					deployment: ["bun --version"],
					research: [],
				},
			},
		},
		null,
		2,
	)}\n`,
	"harness/config.json": `${JSON.stringify(
		{
			version: "1.0.0",
			level: 2,
			project_name: "test-project",
			project_owner: "",
			workspace_roots: ["apps", "packages"],
			default_workspaces: ["apps/web", "apps/api", "packages/shared"],
			layers: ["types", "config", "repo", "service", "runtime", "ui"],
			validation: {
				structural_tests: true,
				linters: true,
				entropy_scans: true,
				doc_freshness_days: 30,
			},
			contextManagement: {
				enabled: true,
				autoCompact: true,
				summaryMaxLines: 12,
				retainRecentArtifacts: 3,
				historyLimit: 25,
			},
			guardians: {
				enabled: true,
				preflight: true,
				stop: true,
				drift: true,
				logFailures: true,
			},
			entropy: {
				enabled: true,
				driftThresholdPercent: 10,
				baselineOnTaskStart: true,
			},
			commit_format: "conventional",
			required_files: [],
		},
		null,
		2,
	)}\n`,
};

export function baseState(): HarnessState {
	return {
		version: "1.0.0",
		projectInfo: {
			projectName: "test-project",
			harnessLevel: "standard",
			runtime: "bun",
			primaryDocs: {
				product: "docs/product.md",
				architecture: "docs/architecture.md",
				progress: "docs/progress.md",
			},
			commandSurface: [],
		},
		planning: {
			phase: "PLANNING",
			docsReady: { product: true, architecture: true, backlog: true },
			approvals: { planApproved: false, currentPhaseApproved: false },
		},
		discovery: {
			stage: "COMPLETE",
			status: "ready_for_plan",
			currentQuestionIds: [],
			answered: {},
			history: [],
			readiness: {
				productReady: true,
				architectureReady: true,
				planReady: true,
			},
			lastUpdatedAt: new Date().toISOString(),
		},
		milestones: [
			{
				id: "M1",
				title: "Test milestone",
				goal: "Test milestone goal",
				status: "planned",
				dependsOn: [],
				parallelEligible: true,
				affectedAreas: [],
				worktreeName: null,
				taskHints: [],
			},
		],
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
			activeGuardrails: [],
			activeExitCriteria: [],
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

function writeRepoFiles(root: string, state: HarnessState): string {
	const files: Record<string, string> = {
		".harness/state.json": `${JSON.stringify(state, null, "\t")}\n`,
		...supportFiles,
	};
	for (const [relativePath, content] of Object.entries(files)) {
		const absolutePath = path.join(root, relativePath);
		mkdirSync(path.dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}
	return root;
}

export function createRepo(
	validationChecks: string[],
	tempRoots: string[],
): string {
	const root = mkdtempSync(path.join(os.tmpdir(), "harness-orchestration-"));
	tempRoots.push(root);
	const state = baseState();
	state.tasks = [
		{
			id: "T101",
			milestoneId: "M1",
			title: "Implement the test feature",
			kind: "implementation",
			status: "pending",
			dependsOn: [],
			affectedFilesOrAreas: ["apps/api"],
			requiredSkills: ["skills/implementation/SKILL.md"],
			validationChecks,
			iteration: 0,
			contractStatus: "missing",
			evaluatorStatus: "pending",
			stallCount: 0,
			lastCheckpointAt: null,
			artifacts: {
				contractPath: null,
				latestEvaluationPath: null,
				latestHandoffPath: null,
			},
		},
	];
	return writeRepoFiles(root, state);
}

export function makeTask(
	overrides: Partial<TaskRecord> & { id: string },
): TaskRecord {
	return {
		milestoneId: "M1",
		title: `Task ${overrides.id}`,
		kind: "implementation",
		status: "pending",
		dependsOn: [],
		affectedFilesOrAreas: [],
		requiredSkills: ["skills/implementation/SKILL.md"],
		validationChecks: ["bun --version"],
		iteration: 0,
		contractStatus: "missing",
		evaluatorStatus: "pending",
		stallCount: 0,
		lastCheckpointAt: null,
		artifacts: {
			contractPath: null,
			latestEvaluationPath: null,
			latestHandoffPath: null,
		},
		...overrides,
	};
}

export function createRepoWithTasks(
	tasks: TaskRecord[],
	tempRoots: string[],
): string {
	const root = mkdtempSync(path.join(os.tmpdir(), "harness-orchestration-"));
	tempRoots.push(root);
	const state = baseState();
	state.tasks = tasks;
	return writeRepoFiles(root, state);
}
