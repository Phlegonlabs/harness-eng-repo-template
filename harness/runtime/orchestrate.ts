import { orchestrateTask } from "./orchestration";
import { loadState } from "./planning";
import { repoRoot } from "./shared";

const root = repoRoot();
const result = orchestrateTask(root);

if (!result) {
	const state = loadState(root);
	const blocked = state.tasks.filter((t) => t.status === "blocked");
	if (state.tasks.length === 0) {
		console.log("ORCHESTRATE BLOCKED");
		console.log("  No task backlog is available yet.");
		console.log("  Next action: run bun run harness:plan first.");
		process.exit(1);
	}
	if (blocked.length > 0) {
		console.log("ORCHESTRATE BLOCKED");
		console.log(`  ${blocked.length} task(s) are blocked:`);
		for (const t of blocked) {
			console.log(`    ${t.id}: ${t.title}`);
		}
		console.log(
			"  Next action: resolve blockers, then run bun run harness:unblock --task <id>.",
		);
		process.exit(1);
	}
	console.log("No pending tasks.");
	console.log("  Next action: all current tasks are complete.");
	process.exit(0);
}

console.log("Orchestrator Status");
console.log(`  Phase: ${result.phase}`);
console.log(`  Task: ${result.task.id} — ${result.task.title}`);
console.log(`  Milestone: ${result.milestone.id}`);
console.log(`  Status: ${result.task.status}`);
console.log(`  Iteration: ${result.task.iteration}`);
console.log(`  Contract: ${result.task.artifacts.contractPath ?? "-"}`);
console.log(`  Handoff: ${result.task.artifacts.latestHandoffPath ?? "-"}`);
console.log(`  Suggested skills: ${result.skills.join(", ")}`);
console.log(`  Next action: ${result.nextAction}`);
