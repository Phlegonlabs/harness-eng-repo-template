import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { loadState, saveState, writeProgressDoc } from "./planning";
import {
	ensureCleanMainWorktree,
	repoRoot,
	runPassthrough,
	slugify,
} from "./shared";
import type { HarnessState, MilestoneRecord } from "./types";

export interface DispatchResult {
	dispatched: string[];
	blocked: Array<{ milestoneId: string; reasons: string[] }>;
}

function overlappingAreas(a: string[], b: string[]): string[] {
	return a.filter((area) => b.includes(area));
}

function milestoneBlockers(
	milestone: MilestoneRecord,
	state: HarnessState,
	activeIds: Set<string>,
	activeMilestones: MilestoneRecord[],
): string[] {
	const blockers: string[] = [];
	if (milestone.status !== "planned") {
		blockers.push(`status is ${milestone.status}`);
	}
	if (!milestone.parallelEligible) {
		blockers.push("parallelEligible is false");
	}
	if (activeIds.has(milestone.id)) {
		blockers.push("milestone is already active");
	}
	const unmetDependencies = milestone.dependsOn.filter((dependencyId) => {
		const dependency = state.milestones.find(
			(entry) => entry.id === dependencyId,
		);
		return dependency?.status !== "complete";
	});
	if (unmetDependencies.length > 0) {
		blockers.push(`unmet dependencies: ${unmetDependencies.join(", ")}`);
	}
	const conflictingAreas = activeMilestones.flatMap((activeMilestone) =>
		overlappingAreas(milestone.affectedAreas, activeMilestone.affectedAreas),
	);
	if (conflictingAreas.length > 0) {
		blockers.push(
			`affected area conflict: ${[...new Set(conflictingAreas)].join(", ")}`,
		);
	}
	return blockers;
}

function syncWorktreeSurfaces(root: string, state: HarnessState): void {
	writeProgressDoc(
		root,
		state.milestones,
		state.tasks,
		state.execution.activeWorktrees,
		state.planning.docsReady,
	);
	for (const active of state.execution.activeWorktrees) {
		const worktreeRoot = path.join(root, active.worktree);
		if (!existsSync(worktreeRoot)) continue;
		saveState(worktreeRoot, state);
		writeProgressDoc(
			worktreeRoot,
			state.milestones,
			state.tasks,
			state.execution.activeWorktrees,
			state.planning.docsReady,
		);
	}
}

export function dispatchMilestones(options: {
	root: string;
	apply: boolean;
	max: number;
}): DispatchResult {
	const { root, apply, max } = options;
	const state = loadState(root);
	const activeIds = new Set(state.execution.activeMilestones);
	const activeMilestones = state.milestones.filter((milestone) =>
		activeIds.has(milestone.id),
	);

	const eligibility = state.milestones.map((milestone) => ({
		milestone,
		blockers: milestoneBlockers(milestone, state, activeIds, activeMilestones),
	}));
	const eligible = eligibility.filter((entry) => entry.blockers.length === 0);
	const blocked = eligibility
		.filter((entry) => entry.blockers.length > 0)
		.map((entry) => ({
			milestoneId: entry.milestone.id,
			reasons: entry.blockers,
		}));

	if (!apply) {
		return { dispatched: [], blocked };
	}

	if (state.milestones.length === 0 || state.tasks.length === 0) {
		return { dispatched: [], blocked };
	}

	if (!ensureCleanMainWorktree(root)) {
		return { dispatched: [], blocked };
	}

	if (eligible.length === 0) {
		return { dispatched: [], blocked };
	}

	const slotsAvailable = Math.max(
		0,
		state.execution.maxParallelMilestones -
			state.execution.activeMilestones.length,
	);
	const toDispatch = eligible.slice(0, Math.min(max, slotsAvailable));
	if (toDispatch.length === 0) {
		return { dispatched: [], blocked };
	}

	const dispatched: string[] = [];
	mkdirSync(path.join(root, ".worktrees"), { recursive: true });
	for (const { milestone } of toDispatch) {
		const branch = `milestone/${milestone.id.toLowerCase()}-${slugify(milestone.title)}`;
		const worktreePath = path.join(
			root,
			".worktrees",
			milestone.id.toLowerCase(),
		);
		const branchExists =
			runPassthrough(
				"git",
				["-C", root, "rev-parse", "--verify", branch],
				root,
			) === 0;
		if (!branchExists) {
			if (
				runPassthrough(
					"git",
					["-C", root, "worktree", "add", "-b", branch, worktreePath, "HEAD"],
					root,
				) !== 0
			) {
				break;
			}
		} else if (!existsSync(worktreePath)) {
			if (
				runPassthrough(
					"git",
					["-C", root, "worktree", "add", worktreePath, branch],
					root,
				) !== 0
			) {
				break;
			}
		}

		milestone.status = "active";
		milestone.worktreeName = `.worktrees/${milestone.id.toLowerCase()}`;
		state.execution.activeMilestones.push(milestone.id);
		state.execution.activeWorktrees.push({
			milestoneId: milestone.id,
			worktree: milestone.worktreeName,
			branch,
			status: "active",
		});
		dispatched.push(milestone.id);
	}

	saveState(root, state);
	syncWorktreeSurfaces(root, state);
	return { dispatched, blocked };
}

/* CLI entry point */
if (import.meta.main) {
	const root = repoRoot();
	const apply = process.argv.includes("--apply");
	const maxArg = process.argv.find((value) => value.startsWith("--max="));
	const max = maxArg ? Number(maxArg.split("=")[1]) : 2;

	const result = dispatchMilestones({ root, apply, max });

	if (!apply) {
		const state = loadState(root);
		const activeIds = new Set(state.execution.activeMilestones);
		const activeMilestones = state.milestones.filter((m) =>
			activeIds.has(m.id),
		);
		const eligibility = state.milestones.map((milestone) => ({
			milestone,
			blockers: milestoneBlockers(
				milestone,
				state,
				activeIds,
				activeMilestones,
			),
		}));
		const eligible = eligibility.filter((e) => e.blockers.length === 0);
		console.log(`Eligible milestones: ${eligible.length}`);
		for (const { milestone } of eligible) {
			console.log(`  ${milestone.id}: ${milestone.title}`);
		}
		for (const { milestone, blockers } of eligibility.filter(
			(e) => e.blockers.length > 0,
		)) {
			console.log(`  BLOCKED ${milestone.id}: ${blockers.join("; ")}`);
		}
		process.exit(0);
	}

	if (result.dispatched.length === 0) {
		const state = loadState(root);
		if (state.milestones.length === 0 || state.tasks.length === 0) {
			console.error("PARALLEL DISPATCH BLOCKED");
			console.error("  No planned backlog is available yet.");
			console.error("  Next action: run bun run harness:plan first.");
			process.exit(1);
		}
		if (!ensureCleanMainWorktree(root)) {
			console.error("PARALLEL DISPATCH BLOCKED");
			console.error("  Main worktree is not clean.");
			console.error(
				"  Next action: commit or stash changes before dispatching milestones.",
			);
			process.exit(1);
		}
		console.error("PARALLEL DISPATCH BLOCKED");
		console.error(
			"  No milestone currently satisfies the dispatch prerequisites.",
		);
		process.exit(1);
	}

	for (const id of result.dispatched) {
		console.log(`Dispatched ${id}`);
	}
}
