import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
	statSync,
} from "node:fs";
import path from "node:path";
import type {
	HarnessRecoveryPoint,
	HarnessState,
	StateSnapshotRecord,
	TaskRecord,
} from "./types";

const SNAPSHOT_DIR = path.join(".harness", "snapshots");
const STATE_FILE = path.join(".harness", "state.json");
const MAX_SNAPSHOTS = 20;

function snapshotDirectory(root: string): string {
	return path.join(root, SNAPSHOT_DIR);
}

function statePath(root: string): string {
	return path.join(root, STATE_FILE);
}

function snapshotTimestamp(date: Date): string {
	return date.toISOString().replace(/[:.]/g, "-");
}

function snapshotFileName(trigger: string, date: Date): string {
	const safeTrigger = trigger.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
	return `state-${snapshotTimestamp(date)}-${safeTrigger}.json`;
}

function parseSnapshotMetadata(fileName: string): {
	createdAt: string;
	trigger: string;
} | null {
	const match = fileName.match(/^state-([0-9TZ-]+)-([a-z0-9-]+)\.json$/i);
	if (!match) return null;
	const [, rawTimestamp, trigger] = match;
	const normalized = rawTimestamp.replace(
		/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3}Z)$/,
		"$1:$2:$3.$4",
	);
	return {
		createdAt: normalized,
		trigger,
	};
}

function trimSnapshots(root: string): void {
	const snapshots = listStateSnapshots(root);
	for (const snapshot of snapshots.slice(MAX_SNAPSHOTS)) {
		rmSync(path.join(root, snapshot.path), { force: true });
	}
}

export function listStateSnapshots(root: string): StateSnapshotRecord[] {
	const directory = snapshotDirectory(root);
	if (!existsSync(directory)) return [];
	return readdirSync(directory)
		.filter((fileName) => fileName.endsWith(".json"))
		.flatMap((fileName) => {
			const metadata = parseSnapshotMetadata(fileName);
			if (!metadata) return [];
			const absolutePath = path.join(directory, fileName);
			const stats = statSync(absolutePath);
			return [
				{
					fileName,
					path: path.join(SNAPSHOT_DIR, fileName).replace(/\\/g, "/"),
					createdAt: metadata.createdAt,
					trigger: metadata.trigger,
					sizeBytes: stats.size,
				},
			];
		})
		.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function focusTask(state: HarnessState): TaskRecord | null {
	for (const status of [
		"evaluation_pending",
		"in_progress",
		"blocked",
		"pending",
	] as const) {
		const match = state.tasks.find((task) => task.status === status);
		if (match) return match;
	}
	return null;
}

function recommendedRecoveryPoint(
	task: TaskRecord | null,
): HarnessRecoveryPoint {
	if (!task) {
		return {
			kind: "none",
			path: null,
			reason: "No task-scoped recovery point is available.",
		};
	}
	if (
		(task.status === "evaluation_pending" || task.status === "blocked") &&
		task.artifacts.latestEvaluationPath
	) {
		return {
			kind: "evaluation",
			path: task.artifacts.latestEvaluationPath,
			reason:
				"Latest evaluation is the strongest recovery point for validating or blocked work.",
		};
	}
	if (task.artifacts.latestHandoffPath) {
		return {
			kind: "handoff",
			path: task.artifacts.latestHandoffPath,
			reason:
				"Latest handoff is the strongest recovery point for in-progress implementation.",
		};
	}
	if (task.artifacts.contractPath) {
		return {
			kind: "contract",
			path: task.artifacts.contractPath,
			reason:
				"Task contract is the only durable task artifact currently available.",
		};
	}
	return {
		kind: "none",
		path: null,
		reason: "No task artifact is available for direct recovery.",
	};
}

function recommendedStateSnapshot(
	snapshots: StateSnapshotRecord[],
	task: TaskRecord | null,
): {
	snapshot: StateSnapshotRecord | null;
	reason: string | null;
} {
	if (snapshots.length === 0) {
		return { snapshot: null, reason: null };
	}
	if (task?.lastCheckpointAt) {
		const checkpointAt = task.lastCheckpointAt;
		const aligned =
			snapshots.find((snapshot) => snapshot.createdAt <= checkpointAt) ?? null;
		if (aligned) {
			return {
				snapshot: aligned,
				reason: "Closest pre-save snapshot before the active task checkpoint.",
			};
		}
	}
	return {
		snapshot: snapshots[0] ?? null,
		reason: "Most recent pre-save state snapshot available in the repository.",
	};
}

export function recommendStateRecovery(
	state: HarnessState,
	snapshots: StateSnapshotRecord[],
): {
	recommendedRecoveryPoint: HarnessRecoveryPoint;
	recommendedStateSnapshot: StateSnapshotRecord | null;
	recommendedStateSnapshotReason: string | null;
} {
	const task = focusTask(state);
	const snapshotRecommendation = recommendedStateSnapshot(snapshots, task);
	return {
		recommendedRecoveryPoint: recommendedRecoveryPoint(task),
		recommendedStateSnapshot: snapshotRecommendation.snapshot,
		recommendedStateSnapshotReason: snapshotRecommendation.reason,
	};
}

export function createStateSnapshot(
	root: string,
	trigger: string,
): string | null {
	const source = statePath(root);
	if (!existsSync(source)) return null;
	const directory = snapshotDirectory(root);
	mkdirSync(directory, { recursive: true });
	const fileName = snapshotFileName(trigger, new Date());
	copyFileSync(source, path.join(directory, fileName));
	trimSnapshots(root);
	return path.join(SNAPSHOT_DIR, fileName).replace(/\\/g, "/");
}

export function recoverStateSnapshot(
	root: string,
	options?: { latest?: boolean; fileName?: string },
): StateSnapshotRecord | null {
	const snapshots = listStateSnapshots(root);
	const selected = options?.fileName
		? (snapshots.find((snapshot) => snapshot.fileName === options.fileName) ??
			null)
		: (snapshots[0] ?? null);
	if (!selected) return null;
	const source = path.join(root, selected.path);
	if (!existsSync(source)) return null;
	createStateSnapshot(root, "pre-recover");
	copyFileSync(source, statePath(root));
	return selected;
}
