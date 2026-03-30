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
const quietSuccess = process.argv.includes("--quiet-success");

const root = repoRoot();
const result = evaluateTask(taskId, root);

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

if (quietSuccess && result.task.evaluatorStatus === "passed") {
	console.log(`PASS: ${result.task.id} evaluation passed.`);
	process.exit(0);
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
	result.task.evaluatorStatus === "failed" &&
	result.task.artifacts.latestEvaluationPath
) {
	const artifact = readJson<TaskEvaluationArtifact>(
		path.join(root, result.task.artifacts.latestEvaluationPath),
	);
	for (const check of artifact.checks.filter((entry) => entry.exitCode !== 0)) {
		const label =
			check.source === "skill-exit"
				? `Failed skill exit gate${check.skills?.length ? ` (${check.skills.join(", ")})` : ""}`
				: "Failed check";
		console.log(`  ${label}: ${check.command}`);
		if (check.logPath) {
			console.log(`  Log: ${check.logPath}`);
		}
	}
}
console.log(`  Next action: ${result.nextAction}`);
