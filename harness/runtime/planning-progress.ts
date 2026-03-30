import path from "node:path";
import { writeTextFile } from "./shared";
import type {
	ActiveWorktreeRecord,
	MilestoneRecord,
	TaskRecord,
} from "./types";

export function writeProgressDoc(
	root: string,
	milestones: MilestoneRecord[],
	tasks: TaskRecord[],
	activeWorktrees: ActiveWorktreeRecord[] = [],
	readiness?: { product: boolean; architecture: boolean; backlog: boolean },
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
		`| \`docs/product.md\` | ${readiness?.product !== false ? "Ready" : "Not Ready"} | PRD status |`,
		`| \`docs/architecture.md\` | ${readiness?.architecture !== false ? "Ready" : "Not Ready"} | Architecture status |`,
		`| Backlog sync | ${readiness?.backlog !== false ? "Ready" : "Not Ready"} | Milestone and task sync status |`,
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
		...(activeWorktrees.length > 0
			? activeWorktrees.map(
					(worktree) =>
						`| ${worktree.worktree} | ${worktree.milestoneId} | ${worktree.branch} | ${worktree.status} |`,
				)
			: ["| - | - | - | No active milestone worktrees |"]),
		"",
		"---",
		"",
		"## Activity Log",
		"",
		`- Planning synchronized on ${new Date().toISOString()}.`,
	].join("\n");

	writeTextFile(path.join(root, "docs/progress.md"), `${progress}\n`);
}
