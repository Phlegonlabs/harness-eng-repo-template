import type {
	ContextReference,
	EvaluationGateCategory,
	EvaluationGateSource,
	TaskEvaluationGate,
} from "./types";

export interface TaskContractArtifact {
	version: string;
	taskId: string;
	milestoneId: string;
	title: string;
	kind: string;
	goal: string;
	affectedAreas: string[];
	deliverables: string[];
	outOfScope: string[];
	contextRefs: ContextReference[];
	advisories: string[];
	validationChecks: string[];
	evaluationGates: TaskEvaluationGate[];
	acceptanceCriteria: string[];
	createdAt: string;
	approvedAt: string | null;
}

export interface TaskEvaluationGateAttempt {
	attempt: number;
	exitCode: number;
	status: "passed" | "failed" | "timed_out";
	durationMs: number;
	outputSnippet: string;
	logPath: string | null;
	infrastructureFailure: boolean;
}

export interface TaskEvaluationGateResult {
	id: string;
	label: string;
	command: string;
	exitCode: number;
	outputSnippet: string;
	status: "passed" | "failed" | "skipped";
	durationMs: number;
	blocking: boolean;
	category: EvaluationGateCategory;
	logPath?: string | null;
	source: EvaluationGateSource;
	skills?: string[];
	reason?: string;
	attemptCount: number;
	recovered: boolean;
	timedOut: boolean;
	attempts: TaskEvaluationGateAttempt[];
}

export type TaskCheckResult = TaskEvaluationGateResult;

export interface TaskEvaluationFinding {
	severity: "blocker" | "warn" | "info";
	gateId?: string;
	message: string;
}

export interface TaskEvaluationArtifact {
	version: string;
	taskId: string;
	milestoneId: string;
	iteration: number;
	status: "passed" | "failed" | "partial";
	evaluatedAt: string;
	mode: "all" | "gate-preview";
	gateResults: TaskEvaluationGateResult[];
	checks: TaskCheckResult[];
	findings: TaskEvaluationFinding[];
	blockingFailures: string[];
	nextAction: string | null;
}

export interface TaskHandoffArtifact {
	version: "1.0.0";
	taskId: string;
	milestoneId: string;
	iteration: number;
	createdAt: string;
	summary: string;
	nextAction: string;
	risks: string[];
	commandLog: string[];
	contractPath: string | null;
	evaluationPath: string | null;
}
