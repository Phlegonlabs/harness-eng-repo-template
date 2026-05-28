import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { runGuardian } from "./guardian";
import { refreshLifecycleArtifacts } from "./lifecycle";
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

interface EligibilityRecord {
	milestone: MilestoneRecord;
	areas: string[];
	blockers: string[];
}

function normalizeArea(area: string): string {
	return area.replace(/\\/g, "/").replace(/\/+$/, "").trim();
}

function milestoneAreas(
	milestone: MilestoneRecord,
	state: HarnessState,
): string[] {
	const explicitAreas = milestone.affectedAreas
		.map(normalizeArea)
		.filter(Boolean);
	if (explicitAreas.length > 0) {
		return [...new Set(explicitAreas)];
	}
	return [
		...new Set(
			state.tasks
				.filter((task) => task.milestoneId === milestone.id)
				.flatMap((task) => task.affectedFilesOrAreas)
				.map(normalizeArea)
				.filter(Boolean),
		),
	];
}

function areasOverlap(left: string, right: string): boolean {
	return (
		left === right ||
		left.startsWith(`${right}/`) ||
		right.startsWith(`${left}/`)
	);
}

function overlappingAreas(a: string[], b: string[]): string[] {
	return [
		...new Set(
			a.flatMap((left) =>
				b
					.filter((right) => areasOverlap(left, right))
					.map((right) => {
						const normalizedLeft = normalizeArea(left);
						const normalizedRight = normalizeArea(right);
						return normalizedLeft.length <= normalizedRight.length
							? normalizedLeft
							: normalizedRight;
					}),
			),
		),
	];
}

function milestoneBlockers(
	milestone: MilestoneRecord,
	areas: string[],
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
	if (areas.length === 0) {
		blockers.push("affected areas are missing");
	}
	const conflictingAreas = activeMilestones.flatMap((activeMilestone) =>
		overlappingAreas(areas, statefulMilestoneAreas(activeMilestone, state)),
	);
	if (conflictingAreas.length > 0) {
		blockers.push(
			`affected area conflict: ${[...new Set(conflictingAreas)].join(", ")}`,
		);
	}
	return blockers;
}

function statefulMilestoneAreas(
	milestone: MilestoneRecord,
	state: HarnessState,
): string[] {
	const areas = milestoneAreas(milestone, state);
	if (areas.length > 0 && milestone.affectedAreas.length === 0) {
		milestone.affectedAreas = areas;
	}
	return areas;
}

function selectDispatchableMilestones(
	eligible: EligibilityRecord[],
	limit: number,
): {
	selected: EligibilityRecord[];
	extraBlocked: Array<{ milestoneId: string; reasons: string[] }>;
} {
	const selected: EligibilityRecord[] = [];
	const extraBlocked: Array<{ milestoneId: string; reasons: string[] }> = [];
	for (const entry of eligible) {
		if (selected.length >= limit) {
			break;
		}
		const conflictingSelection = selected.find(
			(candidate) => overlappingAreas(entry.areas, candidate.areas).length > 0,
		);
		if (!conflictingSelection) {
			selected.push(entry);
			continue;
		}
		const conflicts = overlappingAreas(entry.areas, conflictingSelection.areas);
		extraBlocked.push({
			milestoneId: entry.milestone.id,
			reasons: [
				`dispatch batch conflict with ${conflictingSelection.milestone.id}: ${conflicts.join(", ")}`,
			],
		});
	}
	return { selected, extraBlocked };
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

	const eligibility = state.milestones.map((milestone) => {
		const areas = statefulMilestoneAreas(milestone, state);
		return {
			milestone,
			areas,
			blockers: milestoneBlockers(
				milestone,
				areas,
				state,
				activeIds,
				activeMilestones,
			),
		};
	});
	const individuallyEligible = eligibility.filter(
		(entry) => entry.blockers.length === 0,
	);
	const blocked = eligibility
		.filter((entry) => entry.blockers.length > 0)
		.map((entry) => ({
			milestoneId: entry.milestone.id,
			reasons: entry.blockers,
		}));
	const slotsAvailable = Math.max(
		0,
		state.execution.maxParallelMilestones -
			state.execution.activeMilestones.length,
	);
	const { selected, extraBlocked } = selectDispatchableMilestones(
		individuallyEligible,
		Math.min(max, slotsAvailable),
	);
	const eligible = selected;

	if (!apply) {
		return { dispatched: [], blocked: [...blocked, ...extraBlocked] };
	}

	if (state.milestones.length === 0 || state.tasks.length === 0) {
		return { dispatched: [], blocked };
	}

	if (!ensureCleanMainWorktree(root)) {
		return { dispatched: [], blocked };
	}

	if (eligible.length === 0) {
		return { dispatched: [], blocked: [...blocked, ...extraBlocked] };
	}

	const dispatched: string[] = [];
	mkdirSync(path.join(root, ".worktrees"), { recursive: true });
	for (const { milestone, areas } of eligible) {
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
		milestone.affectedAreas = areas;
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
	return { dispatched, blocked: [...blocked, ...extraBlocked] };
}

/* CLI entry point */
if (import.meta.main) {
	const root = repoRoot();
	const apply = process.argv.includes("--apply");
	const maxArg = process.argv.find((value) => value.startsWith("--max="));
	const max = maxArg ? Number(maxArg.split("=")[1]) : 2;

	if (apply) {
		const guardian = runGuardian({
			root,
			mode: "preflight",
			sourceEvent: "parallel-dispatch",
			persistState: false,
		});
		if (guardian.code !== 0) {
			console.error("PARALLEL DISPATCH BLOCKED");
			for (const line of guardian.lines) {
				console.error(`  ${line}`);
			}
			process.exit(1);
		}
	}

	const result = dispatchMilestones({ root, apply, max });

	if (!apply) {
		const state = loadState(root);
		const activeIds = new Set(state.execution.activeMilestones);
		const activeMilestones = state.milestones.filter((m) =>
			activeIds.has(m.id),
		);
		const eligibility = state.milestones.map((milestone) => {
			const areas = statefulMilestoneAreas(milestone, state);
			return {
				milestone,
				areas,
				blockers: milestoneBlockers(
					milestone,
					areas,
					state,
					activeIds,
					activeMilestones,
				),
			};
		});
		const slotsAvailable = Math.max(
			0,
			state.execution.maxParallelMilestones -
				state.execution.activeMilestones.length,
		);
		const { selected, extraBlocked } = selectDispatchableMilestones(
			eligibility.filter((entry) => entry.blockers.length === 0),
			Math.min(max, slotsAvailable),
		);
		console.log(`Eligible milestones: ${selected.length}`);
		for (const { milestone } of selected) {
			console.log(`  ${milestone.id}: ${milestone.title}`);
		}
		for (const { milestone, blockers } of eligibility.filter(
			(entry) => entry.blockers.length > 0,
		)) {
			console.log(`  BLOCKED ${milestone.id}: ${blockers.join("; ")}`);
		}
		for (const extra of extraBlocked) {
			console.log(
				`  BLOCKED ${extra.milestoneId}: ${extra.reasons.join("; ")}`,
			);
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
	refreshLifecycleArtifacts({
		root,
		sourceEvent: "parallel-dispatch",
	});
}
