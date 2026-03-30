import type {
	ActiveWorktreeRecord,
	HarnessProgressSummary,
	HarnessTaskSummary,
} from "./types";

export type GuardianMode = "preflight" | "stop" | "drift";
export type GuardianStatus = "idle" | "passed" | "warn" | "failed";

export interface GuardianRunRecord {
	status: GuardianStatus;
	runAt: string | null;
	logPath: string | null;
	artifactPath: string | null;
	sourceEvent: string | null;
	summary: string[];
}

export interface EntropySnapshot {
	trackedFiles: number;
	markdownFiles: number;
	sourceFiles: number;
	totalLines: number;
	pendingMarkerCount: number;
}

export interface EntropyBaselineRecord {
	taskId: string;
	capturedAt: string;
	snapshot: EntropySnapshot;
}

export interface EntropyDeltaRecord {
	taskId: string | null;
	checkedAt: string;
	sourceEvent: string;
	percent: number;
	exceeded: boolean;
	baseline: EntropySnapshot | null;
	current: EntropySnapshot;
}

export interface DispatchPacketArtifact {
	version: string;
	packetId: string;
	role: "planner" | "worker" | "sidecar";
	goal: string;
	scope: string;
	allowedTools: string[];
	contextBudget: number;
	returnFormat: "condensed" | "detailed";
	artifactInputs: string[];
	createdAt: string;
	taskId: string | null;
	milestoneId: string | null;
}

export interface DispatchResultArtifact {
	version: string;
	packetId: string;
	role: "planner" | "worker" | "sidecar";
	summary: string;
	sources: Array<{ file: string; line: number; note: string }>;
	recommendedNextAction: string;
	risks: string[];
	completedAt: string;
}

export interface HarnessCompactArtifactSummary {
	path: string | null;
	summaryLines: string[];
}

export interface HarnessCompactSnapshot {
	version: string;
	generatedAt: string;
	sourceEvent: string;
	projectName: string;
	phase: string;
	nextAction: string;
	progress: HarnessProgressSummary;
	loadedSkills: string[];
	loadedSkillReasons: Record<string, string[]>;
	activeTask: HarnessTaskSummary | null;
	blockedTasks: HarnessTaskSummary[];
	activeWorktrees: ActiveWorktreeRecord[];
	guardian: GuardianRunRecord | null;
	entropy: EntropyDeltaRecord | null;
	dispatch: {
		latestPacketPath: string | null;
		latestResultPath: string | null;
	};
	artifacts: {
		contract: HarnessCompactArtifactSummary;
		evaluation: HarnessCompactArtifactSummary;
		handoff: HarnessCompactArtifactSummary;
		dispatchPacket: HarnessCompactArtifactSummary;
		dispatchResult: HarnessCompactArtifactSummary;
	};
}
