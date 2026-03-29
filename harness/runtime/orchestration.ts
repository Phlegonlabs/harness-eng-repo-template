import { execFileSync } from "node:child_process";
import path from "node:path";
import {
	writeTaskContract,
	writeTaskEvaluation,
	writeTaskHandoff,
} from "./orchestration-artifacts";
import { loadState, saveState, writeProgressDoc } from "./planning";
import { readJson, repoRoot } from "./shared";
import type {
	EvaluatorStatus,
	MilestoneRecord,
	SkillRegistry,
	TaskCheckResult,
	TaskEvaluationArtifact,
	TaskEvaluationFinding,
	TaskHandoffArtifact,
	TaskRecord,
} from "./types";

/** Absolute maximum iterations across all retries, including unblocks. */
const MAX_TASK_ITERATIONS = 5;
/** Consecutive failures before automatic blocking. Reset on unblock. */
const MAX_STALL_COUNT = 2;

export interface OrchestrationStatus {
	phase: string;
	task: TaskRecord;
	milestone: MilestoneRecord;
	skills: string[];
	nextAction: string;
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

function dependenciesMet(task: TaskRecord, allTasks: TaskRecord[]): boolean {
	return task.dependsOn.every((depId) => {
		const dep = allTasks.find((t) => t.id === depId);
		return dep?.status === "done";
	});
}

function activeTask(tasks: TaskRecord[]): TaskRecord | null {
	const orderedStatuses = [
		"evaluation_pending",
		"in_progress",
		"pending",
	] as const;
	for (const status of orderedStatuses) {
		const task = tasks.find(
			(entry) => entry.status === status && dependenciesMet(entry, tasks),
		);
		if (task) return task;
	}
	return null;
}

function taskMilestone(
	task: TaskRecord,
	milestones: MilestoneRecord[],
): MilestoneRecord {
	const milestone = milestones.find((entry) => entry.id === task.milestoneId);
	if (!milestone) {
		throw new Error(`Missing milestone for task ${task.id}`);
	}
	return milestone;
}

function registrySkills(
	root: string,
	phase: string,
	task: TaskRecord,
): string[] {
	const registry = readJson<SkillRegistry>(
		path.join(root, "harness/skills/registry.json"),
	);
	return unique([
		...(registry.phases[phase] ?? []),
		...(registry.taskKinds[task.kind] ?? []),
	]);
}

function createInitialHandoff(
	task: TaskRecord,
	milestone: MilestoneRecord,
): TaskHandoffArtifact {
	return {
		version: "1.0.0",
		taskId: task.id,
		milestoneId: milestone.id,
		iteration: task.iteration,
		createdAt: new Date().toISOString(),
		summary: `Task ${task.id} is ready for implementation under milestone ${milestone.id}.`,
		nextAction: `Implement the task, then run bun run harness:evaluate --task ${task.id}.`,
		risks: [
			"Stay inside the task contract and avoid unrelated edits.",
			"Do not hand off until evaluator passes.",
		],
		commandLog: ["bun run harness:orchestrate"],
		contractPath: task.artifacts.contractPath,
		evaluationPath: task.artifacts.latestEvaluationPath,
	};
}

function tokenize(commandLine: string): string[] {
	return (commandLine.match(/"[^"]*"|'[^']*'|[^\s]+/g) ?? []).map((token) =>
		token.replace(/^['"]|['"]$/g, ""),
	);
}

function commandResult(root: string, commandLine: string): TaskCheckResult {
	const [command, ...args] = tokenize(commandLine);
	if (!command) {
		return {
			command: commandLine,
			exitCode: 1,
			outputSnippet: "Empty command.",
		};
	}
	try {
		const stdout = execFileSync(command, args, {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		return {
			command: commandLine,
			exitCode: 0,
			outputSnippet: stdout.trim().split(/\r?\n/).slice(-10).join("\n"),
		};
	} catch (error) {
		const failure =
			typeof error === "object" && error
				? (error as {
						status?: number;
						stdout?: string | Buffer;
						stderr?: string | Buffer;
					})
				: {};
		const stdout =
			typeof failure.stdout === "string"
				? failure.stdout
				: (failure.stdout?.toString("utf8") ?? "");
		const stderr =
			typeof failure.stderr === "string"
				? failure.stderr
				: (failure.stderr?.toString("utf8") ?? "");
		return {
			command: commandLine,
			exitCode: failure.status ?? 1,
			outputSnippet: `${stdout}\n${stderr}`
				.trim()
				.split(/\r?\n/)
				.slice(-12)
				.join("\n"),
		};
	}
}

function evaluationFindings(
	results: TaskCheckResult[],
): TaskEvaluationFinding[] {
	if (results.length === 0) {
		return [
			{
				severity: "info",
				message:
					"No automated validation checks were configured for this task.",
			},
		];
	}
	return results
		.filter((result) => result.exitCode !== 0)
		.map((result) => ({
			severity: "blocker" as const,
			message: `${result.command} failed with exit code ${result.exitCode}.`,
		}));
}

function failureNextStep(task: TaskRecord, blocked: boolean): string {
	if (blocked) {
		return `Task ${task.id} is blocked. Review the latest evaluation and handoff artifacts before retrying manually.`;
	}
	return `Address the evaluator findings, continue work on ${task.id}, then rerun bun run harness:evaluate --task ${task.id}.`;
}

export function orchestrateTask(
	root: string = repoRoot(),
): OrchestrationStatus | null {
	const state = loadState(root);
	const task = activeTask(state.tasks);
	if (!task) {
		return null;
	}

	const milestone = taskMilestone(task, state.milestones);
	state.planning.phase = "EXECUTING";
	state.skills.loaded = registrySkills(root, "EXECUTING", task);

	if (task.status === "pending") {
		task.iteration = Math.max(task.iteration, 1);
		task.contractStatus = "draft";
		task.evaluatorStatus = "pending";
		task.artifacts.contractPath = writeTaskContract(
			root,
			task,
			milestone,
			new Date().toISOString(),
		);
		task.contractStatus = "approved";
		task.status = "in_progress";
		if (milestone.status === "planned") {
			milestone.status = "active";
		}
		task.lastCheckpointAt = new Date().toISOString();
		task.artifacts.latestHandoffPath = writeTaskHandoff(
			root,
			task,
			createInitialHandoff(task, milestone),
		);
	}

	if (!task.artifacts.latestHandoffPath) {
		task.lastCheckpointAt = new Date().toISOString();
		task.artifacts.latestHandoffPath = writeTaskHandoff(
			root,
			task,
			createInitialHandoff(task, milestone),
		);
	}

	saveState(root, state);
	writeProgressDoc(
		root,
		state.milestones,
		state.tasks,
		state.execution.activeWorktrees,
		state.planning.docsReady,
	);
	return {
		phase: state.planning.phase,
		task,
		milestone,
		skills: state.skills.loaded,
		nextAction:
			task.status === "blocked"
				? `Resolve blocker for ${task.id} before continuing.`
				: `Implement ${task.id}, then run bun run harness:evaluate --task ${task.id}.`,
	};
}

export function evaluateTask(
	taskId?: string,
	root: string = repoRoot(),
): OrchestrationStatus | null {
	const state = loadState(root);
	const task =
		(taskId
			? state.tasks.find((entry) => entry.id === taskId)
			: state.tasks.find((entry) =>
					["in_progress", "evaluation_pending"].includes(entry.status),
				)) ?? null;
	if (!task) {
		return null;
	}
	if (!dependenciesMet(task, state.tasks)) {
		throw new Error(
			`Cannot evaluate ${task.id}: dependencies not met (${task.dependsOn.join(", ")}).`,
		);
	}

	const milestone = taskMilestone(task, state.milestones);
	state.planning.phase = "VALIDATING";
	state.skills.loaded = registrySkills(root, "VALIDATING", task);
	const currentIteration = Math.max(task.iteration, 1);
	task.status = "evaluation_pending";
	task.lastCheckpointAt = new Date().toISOString();
	saveState(root, state);

	const checks = task.validationChecks.map((command) =>
		commandResult(root, command),
	);
	const findings = evaluationFindings(checks);
	const failed = findings.some((finding) => finding.severity === "blocker");
	const artifact: TaskEvaluationArtifact = {
		version: "1.0.0",
		taskId: task.id,
		milestoneId: task.milestoneId,
		iteration: currentIteration,
		status: failed ? "failed" : "passed",
		evaluatedAt: new Date().toISOString(),
		checks,
		findings,
	};
	task.artifacts.latestEvaluationPath = writeTaskEvaluation(
		root,
		task,
		artifact,
	);

	let nextAction = `Advance to the next task with bun run harness:orchestrate.`;
	let evaluatorStatus: EvaluatorStatus = "passed";
	let risks: string[] = [];

	if (failed) {
		evaluatorStatus = "failed";
		task.stallCount += 1;
		task.iteration = currentIteration + 1;
		const blocked =
			task.iteration > MAX_TASK_ITERATIONS ||
			task.stallCount >= MAX_STALL_COUNT;
		task.status = blocked ? "blocked" : "in_progress";
		nextAction = failureNextStep(task, blocked);
		risks = findings.map((finding) => finding.message);
	} else {
		task.status = "done";
		task.stallCount = 0;
		task.lastCheckpointAt = new Date().toISOString();
		const milestoneTasks = state.tasks.filter(
			(t) => t.milestoneId === task.milestoneId,
		);
		if (milestoneTasks.every((t) => t.status === "done")) {
			milestone.status = "complete";
		}
	}

	task.evaluatorStatus = evaluatorStatus;
	task.artifacts.latestHandoffPath = writeTaskHandoff(root, task, {
		version: "1.0.0",
		taskId: task.id,
		milestoneId: milestone.id,
		iteration: currentIteration,
		createdAt: new Date().toISOString(),
		summary: failed
			? `Evaluator failed task ${task.id} on iteration ${currentIteration}.`
			: `Evaluator passed task ${task.id} on iteration ${currentIteration}.`,
		nextAction,
		risks,
		commandLog: checks.map(
			(result) => `${result.command} (exit ${result.exitCode})`,
		),
		contractPath: task.artifacts.contractPath,
		evaluationPath: task.artifacts.latestEvaluationPath,
	});

	saveState(root, state);
	writeProgressDoc(
		root,
		state.milestones,
		state.tasks,
		state.execution.activeWorktrees,
		state.planning.docsReady,
	);
	return {
		phase: state.planning.phase,
		task,
		milestone,
		skills: state.skills.loaded,
		nextAction,
	};
}

export function unblockTask(
	taskId: string,
	root: string = repoRoot(),
): TaskRecord | null {
	const state = loadState(root);
	const task = state.tasks.find((t) => t.id === taskId);
	if (!task || task.status !== "blocked") return null;
	task.status = "in_progress";
	task.stallCount = 0;
	saveState(root, state);
	writeProgressDoc(
		root,
		state.milestones,
		state.tasks,
		state.execution.activeWorktrees,
		state.planning.docsReady,
	);
	return task;
}
