import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { buildCompactResume } from "./compact-resume";
import {
	latestGuardianRecord,
	latestTask,
	summarizeContract,
	summarizeDispatchPacket,
	summarizeDispatchResult,
	summarizeEvaluation,
	summarizeHandoff,
} from "./compact-summaries";
import { loadState, saveState } from "./planning";
import {
	readJson,
	repoRelative,
	repoRoot,
	writeJson,
	writeTextFile,
} from "./shared";
import { buildHarnessStatus } from "./status";
import type { HarnessCompactSnapshot, HarnessState } from "./types";

function safeTimestamp(value: string): string {
	return value.replace(/[:.]/g, "-");
}

function targetTaskId(root: string, state: HarnessState): string | null {
	const status = buildHarnessStatus(root);
	if (status.activeTask) {
		return status.activeTask.id;
	}
	return latestTask(state.tasks)?.id ?? null;
}

function summarizeTaskArtifacts(
	root: string,
	state: HarnessState,
	taskId: string | null,
): HarnessCompactSnapshot["artifacts"] {
	const task =
		taskId === null
			? null
			: (state.tasks.find((entry) => entry.id === taskId) ?? null);
	return {
		contract: summarizeContract(root, task?.artifacts.contractPath ?? null),
		evaluation: summarizeEvaluation(
			root,
			task?.artifacts.latestEvaluationPath ?? null,
		),
		handoff: summarizeHandoff(root, task?.artifacts.latestHandoffPath ?? null),
		dispatchPacket: summarizeDispatchPacket(
			root,
			state.dispatch.latestPacketPath,
		),
		dispatchResult: summarizeDispatchResult(
			root,
			state.dispatch.latestResultPath,
		),
	};
}

export function buildCompactSnapshot(
	rootOrOptions?:
		| string
		| {
				root?: string;
				state?: HarnessState;
				sourceEvent?: string;
		  },
): HarnessCompactSnapshot {
	const options =
		typeof rootOrOptions === "string" ? { root: rootOrOptions } : rootOrOptions;
	const root = options?.root ?? repoRoot();
	const state = options?.state ?? loadState(root);
	const status = buildHarnessStatus(root);
	const sourceEvent =
		options?.sourceEvent ?? state.compact.latestSourceEvent ?? "manual";
	return {
		version: "1.0.0",
		generatedAt: new Date().toISOString(),
		sourceEvent,
		projectName: status.projectName,
		phase: status.phase,
		nextAction: status.nextAction,
		progress: status.progress,
		loadedSkills: status.suggestedSkills,
		loadedSkillReasons: state.skills.selectionReasons,
		activeTask: status.activeTask,
		blockedTasks: status.blockedTasks,
		activeWorktrees: status.activeWorktrees,
		resume: buildCompactResume({
			root,
			status,
			state,
			taskId: targetTaskId(root, state),
			sourceEvent,
		}),
		guardian: latestGuardianRecord(state),
		entropy: state.entropy.latestDelta,
		dispatch: {
			latestPacketPath: state.dispatch.latestPacketPath,
			latestResultPath: state.dispatch.latestResultPath,
		},
		artifacts: summarizeTaskArtifacts(root, state, targetTaskId(root, state)),
	};
}

export function renderCompactSnapshot(
	snapshot: HarnessCompactSnapshot,
): string {
	const lines = [
		"# Harness Compact Snapshot",
		"",
		`- Generated: ${snapshot.generatedAt}`,
		`- Event: ${snapshot.sourceEvent}`,
		`- Project: ${snapshot.projectName}`,
		`- Phase: ${snapshot.phase}`,
		`- Next action: ${snapshot.nextAction}`,
		"",
		"## Progress",
		"",
		`- Tasks: ${snapshot.progress.done}/${snapshot.progress.totalTasks} done`,
		`- Blocked tasks: ${snapshot.progress.blocked}`,
		`- Milestones: ${snapshot.progress.completedMilestones}/${snapshot.progress.totalMilestones} complete`,
		"",
		"## Active Task",
		"",
	];

	if (snapshot.activeTask) {
		lines.push(
			`- ${snapshot.activeTask.id}: ${snapshot.activeTask.title}`,
			`- Status: ${snapshot.activeTask.status}`,
			`- Iteration: ${snapshot.activeTask.iteration}/${snapshot.activeTask.maxIterations}`,
		);
	} else {
		lines.push("- No active task.");
	}

	lines.push("", "## Loaded Skills", "");
	if (snapshot.loadedSkills.length > 0) {
		for (const skill of snapshot.loadedSkills) {
			const reasons = snapshot.loadedSkillReasons[skill] ?? [];
			lines.push(
				`- ${skill}${reasons.length > 0 ? ` (${reasons.join(", ")})` : ""}`,
			);
		}
	} else {
		lines.push("- No skills currently loaded.");
	}

	lines.push("", "## Resume", "");
	lines.push(
		`- Active checkpoint: ${snapshot.resume.activeTaskCheckpointAt ?? "-"}`,
	);
	lines.push(
		`- Latest state snapshot: ${snapshot.resume.latestStateSnapshot?.path ?? "-"}`,
	);
	if (snapshot.resume.latestStateSnapshot) {
		lines.push(
			`- Snapshot captured: ${snapshot.resume.latestStateSnapshot.createdAt}`,
		);
	}
	lines.push(
		`- Recommended recovery point: ${
			snapshot.resume.recommendedRecoveryPoint.path
				? `${snapshot.resume.recommendedRecoveryPoint.kind} -> ${snapshot.resume.recommendedRecoveryPoint.path}`
				: "-"
		}`,
	);
	lines.push(
		`- Recovery rationale: ${snapshot.resume.recommendedRecoveryPoint.reason}`,
	);
	lines.push(
		`- Recommended rollback snapshot: ${
			snapshot.resume.recommendedStateSnapshot?.path ?? "-"
		}`,
	);
	if (snapshot.resume.recommendedStateSnapshotReason) {
		lines.push(
			`- Rollback rationale: ${snapshot.resume.recommendedStateSnapshotReason}`,
		);
	}
	if (snapshot.resume.recommendedArtifactPaths.length > 0) {
		lines.push(
			`- Resume artifacts: ${snapshot.resume.recommendedArtifactPaths.join(", ")}`,
		);
	} else {
		lines.push("- Resume artifacts: none");
	}
	if (snapshot.resume.recentStateSnapshots.length > 1) {
		lines.push("- Recent snapshots:");
		for (const snapshotRecord of snapshot.resume.recentStateSnapshots) {
			lines.push(`  - ${snapshotRecord.path} @ ${snapshotRecord.createdAt}`);
		}
	}
	if (snapshot.resume.instructions.length > 0) {
		lines.push("- Resume sequence:");
		for (const instruction of snapshot.resume.instructions) {
			lines.push(`  - ${instruction}`);
		}
	}
	if (snapshot.resume.recentArtifacts.length > 0) {
		lines.push("- Recent task history:");
		for (const artifact of snapshot.resume.recentArtifacts) {
			lines.push(
				`  - ${artifact.kind}: ${artifact.path} @ ${artifact.recordedAt ?? "-"}`,
			);
			for (const line of artifact.summaryLines.slice(0, 2)) {
				lines.push(`    - ${line}`);
			}
		}
	}

	lines.push("", "## Guardian", "");
	if (snapshot.guardian) {
		lines.push(`- Status: ${snapshot.guardian.status}`);
		lines.push(`- Source: ${snapshot.guardian.sourceEvent ?? "-"}`);
		if (snapshot.guardian.logPath) {
			lines.push(`- Log: ${snapshot.guardian.logPath}`);
		}
		for (const line of snapshot.guardian.summary) {
			lines.push(`- ${line}`);
		}
	} else {
		lines.push("- No guardian runs recorded.");
	}

	lines.push("", "## Entropy", "");
	if (snapshot.entropy) {
		lines.push(`- Drift: ${snapshot.entropy.percent}%`);
		lines.push(
			`- Threshold exceeded: ${snapshot.entropy.exceeded ? "yes" : "no"}`,
		);
		lines.push(`- Source: ${snapshot.entropy.sourceEvent}`);
	} else {
		lines.push("- No entropy delta recorded.");
	}

	lines.push("", "## Dispatch", "");
	lines.push(`- Latest packet: ${snapshot.dispatch.latestPacketPath ?? "-"}`);
	lines.push(`- Latest result: ${snapshot.dispatch.latestResultPath ?? "-"}`);

	lines.push("", "## Artifact Summaries", "");
	for (const [label, artifact] of Object.entries(snapshot.artifacts)) {
		lines.push(`### ${label}`);
		lines.push("");
		lines.push(`- Path: ${artifact.path ?? "-"}`);
		for (const line of artifact.summaryLines) {
			lines.push(`- ${line}`);
		}
		lines.push("");
	}

	if (snapshot.blockedTasks.length > 0) {
		lines.push("## Blocked Tasks", "");
		for (const task of snapshot.blockedTasks) {
			lines.push(`- ${task.id}: ${task.title}`);
		}
		lines.push("");
	}

	return `${lines.join("\n").trimEnd()}\n`;
}

function trimHistory(root: string, historyLimit: number): void {
	const historyRoot = path.join(root, ".harness", "compact", "history");
	try {
		const files = readdirSync(historyRoot).sort().reverse();
		for (const stale of files.slice(historyLimit * 2)) {
			rmSync(path.join(historyRoot, stale), { force: true });
		}
	} catch {
		// No history yet.
	}
}

export function writeCompactSnapshot(
	rootOrOptions?:
		| string
		| {
				root?: string;
				sourceEvent?: string;
				state?: HarnessState;
		  },
): {
	jsonPath: string;
	markdownPath: string;
	historyJsonPath: string;
	historyMarkdownPath: string;
	snapshot: HarnessCompactSnapshot;
} {
	const options =
		typeof rootOrOptions === "string" ? { root: rootOrOptions } : rootOrOptions;
	const root = options?.root ?? repoRoot();
	const state = options?.state ?? loadState(root);
	const snapshot = buildCompactSnapshot({
		root,
		state,
		sourceEvent: options?.sourceEvent,
	});
	const outputRoot = path.join(root, ".harness", "compact");
	const historyRoot = path.join(outputRoot, "history");
	const suffix = safeTimestamp(snapshot.generatedAt);
	const subject =
		snapshot.activeTask?.id ?? state.execution.activeMilestones[0] ?? "repo";
	const latestJsonPath = path.join(outputRoot, "latest.json");
	const latestMarkdownPath = path.join(outputRoot, "latest.md");
	const historyJsonPath = path.join(
		historyRoot,
		`${snapshot.sourceEvent}-${subject}-${suffix}.json`,
	);
	const historyMarkdownPath = path.join(
		historyRoot,
		`${snapshot.sourceEvent}-${subject}-${suffix}.md`,
	);
	writeJson(latestJsonPath, snapshot);
	writeTextFile(latestMarkdownPath, renderCompactSnapshot(snapshot));
	writeJson(historyJsonPath, snapshot);
	writeTextFile(historyMarkdownPath, renderCompactSnapshot(snapshot));
	const latestJsonRelative = repoRelative(root, latestJsonPath);
	const latestMarkdownRelative = repoRelative(root, latestMarkdownPath);
	const historyJsonRelative = repoRelative(root, historyJsonPath);
	const historyMarkdownRelative = repoRelative(root, historyMarkdownPath);

	state.compact = {
		latestJsonPath: latestJsonRelative,
		latestMarkdownPath: latestMarkdownRelative,
		lastRunAt: snapshot.generatedAt,
		latestSourceEvent: snapshot.sourceEvent,
	};
	saveState(root, state);
	const historyLimit = readJson<{
		contextManagement: { historyLimit: number };
	}>(path.join(root, "harness/config.json")).contextManagement.historyLimit;
	trimHistory(root, historyLimit);

	return {
		jsonPath: latestJsonRelative,
		markdownPath: latestMarkdownRelative,
		historyJsonPath: historyJsonRelative,
		historyMarkdownPath: historyMarkdownRelative,
		snapshot,
	};
}

if (import.meta.main) {
	const root = repoRoot();
	const asJson = process.argv.includes("--json");
	const result = writeCompactSnapshot({
		root,
		sourceEvent: process.argv.includes("--event")
			? (process.argv[process.argv.indexOf("--event") + 1] ?? "manual")
			: "manual",
	});
	if (asJson) {
		console.log(JSON.stringify(result.snapshot, null, 2));
		process.exit(0);
	}
	console.log("Harness compact snapshot written.");
	console.log(`  JSON: ${result.jsonPath}`);
	console.log(`  Markdown: ${result.markdownPath}`);
	console.log(`  History JSON: ${result.historyJsonPath}`);
	console.log(`  History Markdown: ${result.historyMarkdownPath}`);
}
