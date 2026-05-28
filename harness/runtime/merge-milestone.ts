import { existsSync } from "node:fs";
import path from "node:path";
import { runCommandWithCapture } from "./command-runner";
import { refreshLifecycleArtifacts } from "./lifecycle";
import { loadState, saveState, writeProgressDoc } from "./planning";
import { writeReportArtifact } from "./report-artifacts";
import {
	ensureCleanMainWorktree,
	repoRoot,
	run,
	runPassthrough,
} from "./shared";

export interface MergeResult {
	milestoneId: string;
	status: "merged" | "blocked";
	message: string;
	auditPath: string | null;
}

interface MergeCheckResult {
	command: string;
	exitCode: number;
	status: "passed" | "failed";
	logPath: string | null;
	snippet: string[];
}

const GENERATED_CONFLICT_PATHS = new Set([
	".harness/state.json",
	"docs/progress.md",
]);

function worktreeClean(root: string): boolean {
	return run("git", ["-C", root, "status", "--porcelain"], root) === "";
}

function branchHasUniqueCommits(root: string, branch: string): boolean {
	return (
		Number(
			run("git", ["-C", root, "rev-list", "--count", `HEAD..${branch}`], root),
		) > 0
	);
}

function runMergeCheck(root: string, command: string): MergeCheckResult {
	const result = runCommandWithCapture({
		root,
		commandLine: command,
		logCategory: "merge-milestone-check",
		maxSnippetLines: 8,
	});
	return {
		command,
		exitCode: result.exitCode,
		status: result.exitCode === 0 ? "passed" : "failed",
		logPath: result.logPath,
		snippet: result.snippet,
	};
}

function writeMergeAudit(
	root: string,
	milestoneId: string,
	value: unknown,
): string {
	return writeReportArtifact(
		root,
		"merges",
		`${milestoneId.toLowerCase()}-latest.json`,
		value,
	);
}

function blockedResult(
	root: string,
	milestoneId: string,
	message: string,
	audit: Record<string, unknown>,
): MergeResult {
	return {
		milestoneId,
		status: "blocked",
		message,
		auditPath: writeMergeAudit(root, milestoneId, {
			version: "1.0.0",
			milestoneId,
			status: "blocked",
			message,
			recordedAt: new Date().toISOString(),
			...audit,
		}),
	};
}

function abortMerge(root: string): void {
	runPassthrough("git", ["-C", root, "merge", "--abort"], root);
}

export function mergeMilestone(milestoneId: string, root: string): MergeResult {
	const state = loadState(root);
	const milestone = state.milestones.find((entry) => entry.id === milestoneId);
	const active = state.execution.activeWorktrees.find(
		(entry) => entry.milestoneId === milestoneId,
	);

	if (!milestone || !active) {
		return blockedResult(
			root,
			milestoneId,
			`Milestone ${milestoneId} does not have an active worktree.`,
			{},
		);
	}

	const worktreeRoot = path.join(root, active.worktree);
	if (!existsSync(worktreeRoot)) {
		return blockedResult(
			root,
			milestoneId,
			`Milestone ${milestoneId} worktree is missing: ${active.worktree}.`,
			{ branch: active.branch, worktree: active.worktree },
		);
	}
	const worktreeState = loadState(worktreeRoot);
	const incompleteTasks = worktreeState.tasks.filter(
		(task) => task.milestoneId === milestoneId && task.status !== "done",
	);
	if (incompleteTasks.length > 0) {
		return blockedResult(
			root,
			milestoneId,
			`Milestone ${milestoneId} still has incomplete tasks: ${incompleteTasks.map((task) => task.id).join(", ")}`,
			{ branch: active.branch, worktree: active.worktree },
		);
	}

	if (!ensureCleanMainWorktree(root)) {
		return blockedResult(
			root,
			milestoneId,
			"Main worktree is not clean. Commit or stash changes first.",
			{
				branch: active.branch,
				worktree: active.worktree,
			},
		);
	}
	if (!worktreeClean(worktreeRoot)) {
		return blockedResult(
			root,
			milestoneId,
			"Milestone worktree is not clean. Commit or stash changes inside the worktree first.",
			{ branch: active.branch, worktree: active.worktree },
		);
	}
	if (!branchHasUniqueCommits(root, active.branch)) {
		return blockedResult(
			root,
			milestoneId,
			`Milestone branch ${active.branch} has no commits to merge.`,
			{ branch: active.branch, worktree: active.worktree },
		);
	}

	const checks = [
		runMergeCheck(
			worktreeRoot,
			"bun run harness:guardian --mode preflight --quiet-success --no-state",
		),
		runMergeCheck(
			worktreeRoot,
			"bun run harness:validate --quiet-success --no-state",
		),
	];
	const failingCheck = checks.find((check) => check.exitCode !== 0);
	if (failingCheck) {
		return blockedResult(
			root,
			milestoneId,
			`Milestone ${milestoneId} failed pre-merge validation: ${failingCheck.command}.`,
			{
				branch: active.branch,
				worktree: active.worktree,
				checks,
			},
		);
	}

	const branchHead = run("git", ["-C", root, "rev-parse", active.branch], root);
	let mergeHandled = false;
	if (
		runPassthrough(
			"git",
			["-C", root, "merge", "--no-ff", "--no-commit", active.branch],
			root,
		) !== 0
	) {
		const conflictedFiles = run(
			"git",
			["-C", root, "diff", "--name-only", "--diff-filter=U"],
			root,
		)
			.split(/\r?\n/)
			.map((entry) => entry.trim())
			.filter(Boolean);
		const unsupportedConflicts = conflictedFiles.filter(
			(relativePath) => !GENERATED_CONFLICT_PATHS.has(relativePath),
		);
		if (unsupportedConflicts.length > 0 || conflictedFiles.length === 0) {
			abortMerge(root);
			return blockedResult(
				root,
				milestoneId,
				`The merge of ${active.branch} introduced unsupported conflicts: ${unsupportedConflicts.join(", ") || "unknown conflict"}.`,
				{
					branch: active.branch,
					worktree: active.worktree,
					checks,
					conflictedFiles,
				},
			);
		}
		for (const relativePath of conflictedFiles) {
			if (
				runPassthrough(
					"git",
					["-C", root, "checkout", "--ours", "--", relativePath],
					root,
				) !== 0
			) {
				abortMerge(root);
				return blockedResult(
					root,
					milestoneId,
					`Failed to resolve generated merge conflict for ${relativePath}.`,
					{
						branch: active.branch,
						worktree: active.worktree,
						checks,
						conflictedFiles,
					},
				);
			}
			runPassthrough("git", ["-C", root, "add", "--", relativePath], root);
		}
		mergeHandled = true;
	}
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
		abortMerge(root);
		return blockedResult(
			root,
			milestoneId,
			`Merged state is missing milestone ${milestoneId}.`,
			{ branch: active.branch, worktree: active.worktree, checks },
		);
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
	runPassthrough(
		"git",
		["-C", root, "add", ".harness/state.json", "docs/progress.md"],
		root,
	);
	if (runPassthrough("git", ["-C", root, "commit", "--no-edit"], root) !== 0) {
		abortMerge(root);
		return blockedResult(
			root,
			milestoneId,
			`The merge of ${active.branch} could not be committed.`,
			{
				branch: active.branch,
				worktree: active.worktree,
				checks,
				generatedConflictResolution: mergeHandled,
			},
		);
	}
	runPassthrough(
		"git",
		["-C", root, "worktree", "remove", active.worktree, "--force"],
		root,
	);
	runPassthrough("git", ["-C", root, "branch", "-d", active.branch], root);
	const mergedCommit = run("git", ["-C", root, "rev-parse", "HEAD"], root);
	const auditPath = writeMergeAudit(root, milestoneId, {
		version: "1.0.0",
		milestoneId,
		status: "merged",
		recordedAt: new Date().toISOString(),
		branch: active.branch,
		worktree: active.worktree,
		branchHead,
		mergedCommit,
		checks,
		generatedConflictResolution: mergeHandled
			? [...GENERATED_CONFLICT_PATHS]
			: [],
	});
	return {
		milestoneId,
		status: "merged",
		message: `Merged milestone ${milestoneId}.`,
		auditPath,
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

	refreshLifecycleArtifacts({
		root,
		sourceEvent: "merge-milestone",
	});
	console.log(result.message);
}
