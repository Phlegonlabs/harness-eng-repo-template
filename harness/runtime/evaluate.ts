import path from "node:path";
import { runGuardian } from "./guardian";
import { refreshLifecycleArtifacts } from "./lifecycle";
import { evaluateTask } from "./orchestration";
import { loadState } from "./planning";
import { readJson, repoRoot } from "./shared";
import type { TaskEvaluationArtifact } from "./types";

const taskArgIndex = process.argv.indexOf("--task");
const taskId =
	taskArgIndex >= 0 && process.argv.length > taskArgIndex + 1
		? process.argv[taskArgIndex + 1]
		: undefined;
const gateArgIndex = process.argv.indexOf("--gate");
const gateId =
	gateArgIndex >= 0 && process.argv.length > gateArgIndex + 1
		? process.argv[gateArgIndex + 1]
		: undefined;
const quietSuccess = process.argv.includes("--quiet-success");
const jsonMode = process.argv.includes("--json");
const reportMode = process.argv.includes("--report");
const previewMode = Boolean(gateId);

const root = repoRoot();
const result = evaluateTask(taskId, root, {
	gateId,
	preview: previewMode,
});

if (!result) {
	const state = loadState(root);
	console.log("EVALUATE BLOCKED");
	if (state.tasks.length === 0) {
		console.log("  No planned task backlog is available.");
		console.log(
			"  Next action: run bun run harness:plan, then bun run harness:orchestrate.",
		);
		process.exit(1);
	}
	console.log("  No active task is currently in progress.");
	console.log("  Next action: run bun run harness:orchestrate first.");
	process.exit(1);
}

if (result.task.evaluatorStatus === "passed") {
	const guardian = runGuardian({
		root,
		mode: "stop",
		sourceEvent: "evaluate",
	});
	if (guardian.code !== 0) {
		for (const line of guardian.lines) {
			console.log(line);
		}
		refreshLifecycleArtifacts({
			root,
			sourceEvent: "evaluate",
			taskId: result.task.id,
		});
		process.exit(1);
	}
}

refreshLifecycleArtifacts({
	root,
	sourceEvent: "evaluate",
	taskId: result.task.id,
});

const latestArtifact =
	result.task.artifacts.latestEvaluationPath &&
	result.task.artifacts.latestEvaluationPath !== null
		? readJson<TaskEvaluationArtifact>(
				path.join(root, result.task.artifacts.latestEvaluationPath),
			)
		: null;

if (quietSuccess && result.task.evaluatorStatus === "passed") {
	console.log(`PASS: ${result.task.id} evaluation passed.`);
	process.exit(0);
}

if (jsonMode) {
	console.log(
		JSON.stringify(
			{
				phase: result.phase,
				task: result.task,
				milestone: result.milestone,
				skills: result.skills,
				nextAction: result.nextAction,
				evaluation: latestArtifact ?? null,
			},
			null,
			2,
		),
	);
	process.exit(
		result.task.evaluatorStatus === "failed" ||
			latestArtifact?.status === "failed"
			? 1
			: 0,
	);
}

console.log("Evaluator Status");
console.log(`  Phase: ${result.phase}`);
console.log(`  Task: ${result.task.id} — ${result.task.title}`);
console.log(`  Milestone: ${result.milestone.id}`);
console.log(`  Status: ${result.task.status}`);
console.log(`  Iteration: ${result.task.iteration}`);
console.log(`  Evaluator: ${result.task.evaluatorStatus}`);
console.log(
	`  Evaluation artifact: ${result.task.artifacts.latestEvaluationPath ?? "-"}`,
);
console.log(
	`  Handoff artifact: ${result.task.artifacts.latestHandoffPath ?? "-"}`,
);
if (
	(result.task.evaluatorStatus === "failed" || previewMode) &&
	latestArtifact
) {
	for (const check of latestArtifact.gateResults.filter(
		(entry) => entry.exitCode !== 0,
	)) {
		const label =
			check.source === "skill-exit"
				? `Failed skill exit gate${check.skills?.length ? ` (${check.skills.join(", ")})` : ""}`
				: "Failed check";
		console.log(`  ${label}: ${check.label} (${check.command})`);
		if (check.logPath) {
			console.log(`  Log: ${check.logPath}`);
		}
	}
	if (reportMode) {
		console.log(`  Gate results: ${latestArtifact.gateResults.length}`);
		console.log(
			`  Blocking failures: ${latestArtifact.blockingFailures.join(", ") || "-"}`,
		);
	}
}
console.log(`  Next action: ${result.nextAction}`);
process.exit(
	result.task.evaluatorStatus === "failed" ||
		latestArtifact?.status === "failed"
		? 1
		: 0,
);
