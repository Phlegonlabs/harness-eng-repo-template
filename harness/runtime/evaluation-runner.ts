import { runCommandWithCapture } from "./command-runner";
import type { ResolvedSkillSelection } from "./skill-types";
import { normalizeTaskEvaluationGates, skillExitGate } from "./task-evaluation";
import type {
	TaskEvaluationArtifact,
	TaskEvaluationFinding,
	TaskEvaluationGate,
	TaskEvaluationGateResult,
	TaskRecord,
} from "./types";

function commandResult(options: {
	root: string;
	gate: TaskEvaluationGate;
	skills?: string[];
}): TaskEvaluationGateResult {
	const { root, gate, skills } = options;
	const startedAt = Date.now();
	const result = runCommandWithCapture({
		root,
		commandLine: gate.command,
		logCategory:
			gate.source === "skill-exit"
				? "evaluation-skill-exit"
				: "evaluation-check",
		maxSnippetLines: 12,
	});
	return {
		id: gate.id,
		label: gate.label,
		command: gate.command,
		exitCode: result.exitCode,
		outputSnippet: result.snippet.join("\n"),
		status: result.exitCode === 0 ? "passed" : "failed",
		durationMs: Date.now() - startedAt,
		blocking: gate.blocking,
		category: gate.category,
		logPath: result.logPath,
		source: gate.source,
		skills,
	};
}

function skippedGateResult(gate: TaskEvaluationGate): TaskEvaluationGateResult {
	return {
		id: gate.id,
		label: gate.label,
		command: gate.command,
		exitCode: 0,
		outputSnippet: "",
		status: "skipped",
		durationMs: 0,
		blocking: gate.blocking,
		category: gate.category,
		source: gate.source,
		reason: "blocked by an earlier blocking gate failure",
	};
}

export function resolvedTaskGates(
	task: TaskRecord,
	skillResolution: ResolvedSkillSelection,
): Array<{ gate: TaskEvaluationGate; skills?: string[] }> {
	const taskGates = normalizeTaskEvaluationGates(
		task.validationChecks,
		task.evaluationGates,
	);
	task.evaluationGates = taskGates;
	const skillGates = skillResolution.exitCriteria.map((entry, index) => ({
		gate: skillExitGate(entry.command, index),
		skills: entry.skills,
	}));
	return [...taskGates.map((gate) => ({ gate })), ...skillGates];
}

export function runEvaluationGates(options: {
	root: string;
	gates: Array<{ gate: TaskEvaluationGate; skills?: string[] }>;
}): TaskEvaluationGateResult[] {
	const results: TaskEvaluationGateResult[] = [];
	let blocked = false;
	for (const entry of options.gates) {
		if (blocked) {
			results.push(skippedGateResult(entry.gate));
			continue;
		}
		const result = commandResult({
			root: options.root,
			gate: entry.gate,
			skills: entry.skills,
		});
		results.push(result);
		if (result.blocking && result.status === "failed") {
			blocked = true;
		}
	}
	return results;
}

export function evaluationFindings(
	results: TaskEvaluationGateResult[],
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
			gateId: result.id,
			severity: result.blocking ? ("blocker" as const) : ("warn" as const),
			message:
				result.source === "skill-exit"
					? `${result.label} failed with exit code ${result.exitCode} for skill exit gate ${result.skills?.join(", ") ?? "unknown"}.`
					: `${result.label} failed with exit code ${result.exitCode}.`,
		}));
}

export function buildEvaluationArtifact(options: {
	task: TaskRecord;
	iteration: number;
	gateResults: TaskEvaluationGateResult[];
	mode: "all" | "gate-preview";
	nextAction: string | null;
}): TaskEvaluationArtifact {
	const { task, iteration, gateResults, mode, nextAction } = options;
	return {
		version: "1.0.0",
		taskId: task.id,
		milestoneId: task.milestoneId,
		iteration,
		status:
			mode === "gate-preview"
				? gateResults.some(
						(result) => result.blocking && result.status === "failed",
					)
					? "failed"
					: "partial"
				: gateResults.some(
							(result) => result.blocking && result.status === "failed",
						)
					? "failed"
					: "passed",
		evaluatedAt: new Date().toISOString(),
		mode,
		gateResults,
		checks: gateResults,
		findings: evaluationFindings(gateResults),
		blockingFailures: gateResults
			.filter((result) => result.blocking && result.status === "failed")
			.map((result) => result.id),
		nextAction,
	};
}
