import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { summarizeEvaluation, summarizeHandoff } from "./compact-summaries";
import { readJson } from "./shared";
import type {
	HarnessCompactRecentArtifact,
	HarnessCompactSnapshot,
	HarnessConfig,
	HarnessState,
	HarnessStatusSnapshot,
	TaskEvaluationArtifact,
	TaskHandoffArtifact,
} from "./types";

function compactConfig(root: string): HarnessConfig["contextManagement"] {
	return readJson<HarnessConfig>(path.join(root, "harness/config.json"))
		.contextManagement;
}

function taskHistoryPaths(
	root: string,
	dirname: "evaluations" | "handoffs",
	taskId: string,
	limit: number,
): string[] {
	const directory = path.join(root, ".harness", dirname);
	if (!existsSync(directory)) return [];
	return readdirSync(directory)
		.filter(
			(fileName) =>
				fileName.startsWith(`${taskId}-`) && fileName.endsWith(".json"),
		)
		.sort()
		.reverse()
		.slice(0, limit)
		.map((fileName) =>
			path.join(".harness", dirname, fileName).replace(/\\/g, "/"),
		);
}

function recentEvaluations(
	root: string,
	taskId: string,
	limit: number,
): HarnessCompactRecentArtifact[] {
	return taskHistoryPaths(root, "evaluations", taskId, limit).map(
		(relativePath) => {
			const artifact = readJson<TaskEvaluationArtifact>(
				path.join(root, relativePath),
			);
			return {
				kind: "evaluation" as const,
				path: relativePath,
				recordedAt: artifact.evaluatedAt,
				summaryLines: summarizeEvaluation(root, relativePath).summaryLines,
			};
		},
	);
}

function recentHandoffs(
	root: string,
	taskId: string,
	limit: number,
): HarnessCompactRecentArtifact[] {
	return taskHistoryPaths(root, "handoffs", taskId, limit).map(
		(relativePath) => {
			const artifact = readJson<TaskHandoffArtifact>(
				path.join(root, relativePath),
			);
			return {
				kind: "handoff" as const,
				path: relativePath,
				recordedAt: artifact.createdAt,
				summaryLines: summarizeHandoff(root, relativePath).summaryLines,
			};
		},
	);
}

function recentArtifacts(
	root: string,
	taskId: string | null,
	limit: number,
): HarnessCompactRecentArtifact[] {
	if (!taskId) return [];
	return [
		...recentEvaluations(root, taskId, limit),
		...recentHandoffs(root, taskId, limit),
	]
		.sort((left, right) =>
			(right.recordedAt ?? "").localeCompare(left.recordedAt ?? ""),
		)
		.slice(0, limit);
}

function compactInstructions(options: {
	status: HarnessStatusSnapshot;
	sourceEvent: string;
	recentArtifacts: HarnessCompactRecentArtifact[];
}): string[] {
	const { status, sourceEvent, recentArtifacts } = options;
	const lines: string[] = [];
	const [firstArtifact, secondArtifact] = recentArtifacts;
	if (status.blockedTasks.length > 0 && !status.activeTask) {
		lines.push(
			"Resume from the blocked task's latest evaluation result before changing code.",
		);
	} else if (sourceEvent === "evaluate") {
		lines.push(
			"Resume by reading the latest evaluation result first, then the latest handoff.",
		);
	} else if (sourceEvent === "orchestrate") {
		lines.push(
			"Resume by reading the task contract first, then the latest handoff.",
		);
	} else {
		lines.push(
			"Resume by checking the latest handoff and state snapshot before reopening files.",
		);
	}
	if (firstArtifact) {
		lines.push(`Start with: ${firstArtifact.path}`);
	}
	if (secondArtifact) {
		lines.push(`Then inspect: ${secondArtifact.path}`);
	}
	if (status.resume.latestStateSnapshot) {
		lines.push(
			`Fallback state snapshot: ${status.resume.latestStateSnapshot.path}`,
		);
	}
	return lines;
}

export function buildCompactResume(options: {
	root: string;
	status: HarnessStatusSnapshot;
	state: HarnessState;
	taskId: string | null;
	sourceEvent: string;
}): HarnessCompactSnapshot["resume"] {
	const { root, status, taskId, sourceEvent } = options;
	const limit = Math.max(1, compactConfig(root).retainRecentArtifacts);
	const history = recentArtifacts(root, taskId, limit);
	return {
		...status.resume,
		instructions: compactInstructions({
			status,
			sourceEvent,
			recentArtifacts: history,
		}),
		recentArtifacts: history,
	};
}
