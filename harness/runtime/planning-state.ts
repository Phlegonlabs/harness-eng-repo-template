import { defaultCommandSurface as loadDefaultCommandSurface } from "./command-surface";
import type { TaskRecord } from "./types";

export function defaultCommandSurface(root?: string): string[] {
	return loadDefaultCommandSurface(root);
}

export function createTaskRecord(
	task: Omit<
		TaskRecord,
		| "iteration"
		| "contractStatus"
		| "evaluatorStatus"
		| "stallCount"
		| "lastCheckpointAt"
		| "artifacts"
	>,
): TaskRecord {
	return {
		...task,
		iteration: 0,
		contractStatus: "missing",
		evaluatorStatus: "pending",
		stallCount: 0,
		lastCheckpointAt: null,
		artifacts: {
			contractPath: null,
			latestEvaluationPath: null,
			latestHandoffPath: null,
		},
	};
}

export function normalizeTaskRecord(task: TaskRecord): TaskRecord {
	return {
		...task,
		status: task.status ?? "pending",
		iteration: task.iteration ?? 0,
		contractStatus: task.contractStatus ?? "missing",
		evaluatorStatus: task.evaluatorStatus ?? "pending",
		stallCount: task.stallCount ?? 0,
		lastCheckpointAt: task.lastCheckpointAt ?? null,
		artifacts: {
			contractPath: task.artifacts?.contractPath ?? null,
			latestEvaluationPath: task.artifacts?.latestEvaluationPath ?? null,
			latestHandoffPath: task.artifacts?.latestHandoffPath ?? null,
		},
	};
}
