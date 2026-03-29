import { evaluateTask } from "./orchestration";
import { loadState } from "./planning";
import { repoRoot } from "./shared";

const taskArgIndex = process.argv.indexOf("--task");
const taskId =
	taskArgIndex >= 0 && process.argv.length > taskArgIndex + 1
		? process.argv[taskArgIndex + 1]
		: undefined;

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
console.log(`  Next action: ${result.nextAction}`);
