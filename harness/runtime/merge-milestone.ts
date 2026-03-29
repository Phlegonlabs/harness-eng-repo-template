import path from "node:path";
import { loadState, saveState, writeProgressDoc } from "./planning";
import { ensureCleanMainWorktree, repoRoot, runPassthrough } from "./shared";

export interface MergeResult {
	milestoneId: string;
	status: "merged" | "blocked";
	message: string;
}

export function mergeMilestone(milestoneId: string, root: string): MergeResult {
	const state = loadState(root);
	const milestone = state.milestones.find((entry) => entry.id === milestoneId);
	const active = state.execution.activeWorktrees.find(
		(entry) => entry.milestoneId === milestoneId,
	);

	if (!milestone || !active) {
		return {
			milestoneId,
			status: "blocked",
			message: `Milestone ${milestoneId} does not have an active worktree.`,
		};
	}

	const worktreeRoot = path.join(root, active.worktree);
	const worktreeState = loadState(worktreeRoot);
	const incompleteTasks = worktreeState.tasks.filter(
		(task) => task.milestoneId === milestoneId && task.status !== "done",
	);
	if (incompleteTasks.length > 0) {
		return {
			milestoneId,
			status: "blocked",
			message: `Milestone ${milestoneId} still has incomplete tasks: ${incompleteTasks.map((task) => task.id).join(", ")}`,
		};
	}

	if (!ensureCleanMainWorktree(root)) {
		return {
			milestoneId,
			status: "blocked",
			message: "Main worktree is not clean. Commit or stash changes first.",
		};
	}

	// -X ours: state files (.harness/state.json, docs/progress.md) always
	// conflict between main and worktree. The post-merge reconciliation below
	// handles state merging explicitly. Source code conflicts are prevented by
	// the area-isolation model in parallel-dispatch (overlapping affectedAreas
	// block concurrent dispatch).
	if (
		runPassthrough(
			"git",
			["-C", root, "merge", "--no-ff", "-X", "ours", active.branch],
			root,
		) !== 0
	) {
		return {
			milestoneId,
			status: "blocked",
			message: `The merge of ${active.branch} into main failed. Check git output for details.`,
		};
	}
	runPassthrough(
		"git",
		["-C", root, "worktree", "remove", active.worktree, "--force"],
		root,
	);
	runPassthrough("git", ["-C", root, "branch", "-d", active.branch], root);

	const mergedState = loadState(root);
	const completedTasks = new Map(
		worktreeState.tasks
			.filter((task) => task.milestoneId === milestoneId)
			.map((task) => [task.id, task]),
	);
	mergedState.tasks = mergedState.tasks.map(
		(task) => completedTasks.get(task.id) ?? task,
	);
	const mergedMilestone = mergedState.milestones.find(
		(entry) => entry.id === milestoneId,
	);
	if (!mergedMilestone) {
		return {
			milestoneId,
			status: "blocked",
			message: `Merged state is missing milestone ${milestoneId}.`,
		};
	}

	mergedMilestone.status = "complete";
	mergedMilestone.worktreeName = null;
	mergedState.execution.activeMilestones =
		mergedState.execution.activeMilestones.filter(
			(entry) => entry !== milestoneId,
		);
	mergedState.execution.activeWorktrees =
		mergedState.execution.activeWorktrees.filter(
			(entry) => entry.milestoneId !== milestoneId,
		);
	saveState(root, mergedState);
	writeProgressDoc(
		root,
		mergedState.milestones,
		mergedState.tasks,
		mergedState.execution.activeWorktrees,
		mergedState.planning.docsReady,
	);
	return {
		milestoneId,
		status: "merged",
		message: `Merged milestone ${milestoneId}.`,
	};
}

/* CLI entry point */
if (import.meta.main) {
	const milestoneId = process.argv.at(-1);
	if (!milestoneId || !/^M\d+$/.test(milestoneId)) {
		console.error("Usage: bun run harness:merge-milestone -- M1");
		process.exit(1);
	}

	const root = repoRoot();
	const result = mergeMilestone(milestoneId, root);

	if (result.status === "blocked") {
		console.error("MERGE MILESTONE BLOCKED");
		console.error(`  ${result.message}`);
		process.exit(1);
	}

	console.log(result.message);
}
