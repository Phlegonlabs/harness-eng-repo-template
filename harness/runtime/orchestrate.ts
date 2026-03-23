import path from "node:path";
import { loadState, saveState } from "./planning";
import { readJson, repoRoot } from "./shared";
import type { SkillRegistry } from "./types";

const root = repoRoot();
const state = loadState(root);
const registry = readJson<SkillRegistry>(
	path.join(root, "harness/skills/registry.json"),
);
const pendingTask = state.tasks.find((task) => task.status === "pending");

if (!pendingTask) {
	console.log("No pending tasks.");
	process.exit(0);
}

const phaseSkills = registry.phases[state.planning.phase] ?? [];
const taskSkills = registry.taskKinds[pendingTask.kind] ?? [];
state.skills.loaded = [...new Set([...phaseSkills, ...taskSkills])];
saveState(root, state);

console.log("Orchestrator Status");
console.log(`  Phase: ${state.planning.phase}`);
console.log(`  Pending task: ${pendingTask.id} — ${pendingTask.title}`);
console.log(`  Milestone: ${pendingTask.milestoneId}`);
console.log(`  Suggested skills: ${state.skills.loaded.join(", ")}`);
console.log(`  Active milestones: ${state.execution.activeMilestones.length}`);
