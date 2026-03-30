import type { ActiveWorktreeRecord, TaskStatus } from "./types";

export interface HarnessTaskSummary {
	id: string;
	title: string;
	kind: string;
	status: TaskStatus;
	iteration: number;
	maxIterations: number;
	stallCount: number;
	milestoneId: string;
	contractPath: string | null;
	latestEvaluationPath: string | null;
	latestHandoffPath: string | null;
	requiredSkills: string[];
	evaluationGateCount: number;
}

export interface HarnessProgressSummary {
	totalTasks: number;
	pending: number;
	inProgress: number;
	evaluationPending: number;
	blocked: number;
	done: number;
	totalMilestones: number;
	activeMilestones: number;
	completedMilestones: number;
}

export interface HarnessStatusSnapshot {
	projectName: string;
	phase: string;
	activeTask: HarnessTaskSummary | null;
	blockedTasks: HarnessTaskSummary[];
	suggestedSkills: string[];
	nextAction: string;
	validationStatus: "unknown";
	progress: HarnessProgressSummary;
	activeWorktrees: ActiveWorktreeRecord[];
	discovery: {
		productReady: boolean;
		architectureReady: boolean;
		planReady: boolean;
	};
}
