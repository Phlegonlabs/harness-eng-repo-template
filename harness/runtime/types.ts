import type { DiscoveryState } from "./discovery-types";
import type {
	EntropyBaselineRecord,
	EntropyDeltaRecord,
	GuardianRunRecord,
} from "./lifecycle-types";
import type {
	DocFreshnessRuleSet,
	GoldenPrinciplesRuleSet,
	ObservabilityProfilesConfig,
	QualityDimensionsConfig,
	ReviewChecklist,
} from "./policy-types";

export interface HarnessConfig {
	version: string;
	level: number;
	project_name: string;
	project_owner?: string;
	workspace_roots: string[];
	default_workspaces: string[];
	layers: string[];
	validation: {
		structural_tests: boolean;
		linters: boolean;
		entropy_scans: boolean;
		doc_freshness_days: number;
	};
	evaluation?: {
		commandTimeoutMs: number;
		maxRetriesOnInfrastructureFailure: number;
		baseBackoffMs: number;
		maxBackoffMs: number;
		retryableCategories: EvaluationGateCategory[];
	};
	contextManagement: {
		enabled: boolean;
		autoCompact: boolean;
		summaryMaxLines: number;
		retainRecentArtifacts: number;
		historyLimit: number;
	};
	guardians: {
		enabled: boolean;
		preflight: boolean;
		stop: boolean;
		drift: boolean;
		logFailures: boolean;
	};
	entropy: {
		enabled: boolean;
		driftThresholdPercent: number;
		baselineOnTaskStart: boolean;
	};
	quality?: {
		enabled: boolean;
		gradesPath: string;
		historyPath: string;
	};
	observability?: {
		enabled: boolean;
		activeProfile: string | null;
		defaultLogLimit: number;
	};
	commit_format: string;
	required_files: string[];
}

export interface LayerRule {
	name: string;
	index: number;
	directories: string[];
	file_patterns?: string[];
	allowed_imports: string[];
}

export interface DependencyRules {
	workspace_roots?: string[];
	source_roots?: string[];
	internal_import_roots: string[];
	internal_import_aliases: Record<string, string>;
	unlayered_allowed_patterns?: string[];
	cross_workspace?: {
		forbid_relative: boolean;
		allow_package_root: boolean;
		allow_exported_subpaths: boolean;
	};
	layers: LayerRule[];
}

export interface FileSizeRules {
	default_limit: number;
	rules: Array<{ pattern: string; limit: number; reason: string }>;
	excluded_patterns: string[];
}

export interface NamingRules {
	rules: Array<{
		path_pattern: string;
		file_case: string;
		violation_message: string;
	}>;
	excluded_patterns: string[];
	case_patterns: Record<string, string>;
}

export interface ForbiddenRule {
	id: string;
	pattern: string;
	description: string;
	apply_to: string[];
	exclude?: string[];
	message: string;
}

export interface ForbiddenRules {
	rules: ForbiddenRule[];
}

export interface MilestoneRecord {
	id: string;
	title: string;
	goal: string;
	status: string;
	dependsOn: string[];
	parallelEligible: boolean;
	affectedAreas: string[];
	worktreeName: string | null;
	taskHints: string[];
}

export type TaskStatus =
	| "pending"
	| "in_progress"
	| "evaluation_pending"
	| "done"
	| "blocked";

export type ContractStatus = "missing" | "draft" | "approved";
export type EvaluatorStatus = "pending" | "passed" | "failed";
export type EvaluationGateCategory =
	| "validation"
	| "typecheck"
	| "lint"
	| "test"
	| "structural"
	| "entropy"
	| "docs"
	| "runtime"
	| "quality"
	| "custom"
	| "skill-exit";
export type EvaluationGateSource = "task" | "skill-exit";

export interface TaskEvaluationGate {
	id: string;
	label: string;
	command: string;
	category: EvaluationGateCategory;
	blocking: boolean;
	source: EvaluationGateSource;
}

export interface TaskArtifacts {
	contractPath: string | null;
	latestEvaluationPath: string | null;
	latestHandoffPath: string | null;
}

export interface ContextReference {
	kind: string;
	label: string;
	path: string;
	required: boolean;
}

export interface TaskContextSummary {
	refs: ContextReference[];
	advisories: string[];
}

export interface ContextManifestEntry {
	kind: string;
	source: string;
	target: string;
	mode: "replace" | "merge";
	isDirectory: boolean;
	syncedAt: string;
}

export interface ContextManifest {
	version: string;
	syncedAt: string | null;
	entries: ContextManifestEntry[];
}

export interface TaskRecord {
	id: string;
	milestoneId: string;
	title: string;
	kind: string;
	status: TaskStatus;
	dependsOn: string[];
	affectedFilesOrAreas: string[];
	requiredSkills: string[];
	validationChecks: string[];
	evaluationGates: TaskEvaluationGate[];
	acceptanceCriteria: string[];
	iteration: number;
	contractStatus: ContractStatus;
	evaluatorStatus: EvaluatorStatus;
	stallCount: number;
	lastCheckpointAt: string | null;
	artifacts: TaskArtifacts;
}

export interface ActiveWorktreeRecord {
	milestoneId: string;
	worktree: string;
	branch: string;
	status: string;
}

export interface StateSnapshotRecord {
	fileName: string;
	path: string;
	createdAt: string;
	trigger: string;
	sizeBytes: number;
}

export interface HarnessState {
	version: string;
	projectInfo: {
		projectName: string;
		harnessLevel: string;
		runtime: string;
		primaryDocs: {
			product: string;
			architecture: string;
			progress: string;
		};
		commandSurface: string[];
	};
	planning: {
		phase: string;
		docsReady: {
			product: boolean;
			architecture: boolean;
			backlog: boolean;
		};
		approvals: {
			planApproved: boolean;
			currentPhaseApproved: boolean;
		};
	};
	discovery: DiscoveryState;
	milestones: MilestoneRecord[];
	tasks: TaskRecord[];
	execution: {
		activeMilestones: string[];
		activeWorktrees: ActiveWorktreeRecord[];
		maxParallelMilestones: number;
	};
	skills: {
		registry: string;
		progressiveDisclosure: boolean;
		loaded: string[];
		selectionReasons: Record<string, string[]>;
		activeGuardrails?: string[];
		activeExitCriteria?: Array<{
			command: string;
			skills: string[];
		}>;
	};
	compact: {
		latestJsonPath: string | null;
		latestMarkdownPath: string | null;
		lastRunAt: string | null;
		latestSourceEvent: string | null;
	};
	guardians: {
		preflight: GuardianRunRecord;
		stop: GuardianRunRecord;
		drift: GuardianRunRecord;
	};
	entropy: {
		baselines: Record<string, EntropyBaselineRecord>;
		latestDelta: EntropyDeltaRecord | null;
	};
	dispatch: {
		queuedSidecars: string[];
		latestPacketPath: string | null;
		latestResultPath: string | null;
	};
}

export type {
	DispatchPacketArtifact,
	DispatchResultArtifact,
	EntropyBaselineRecord,
	EntropyDeltaRecord,
	EntropySnapshot,
	GuardianMode,
	GuardianRunRecord,
	HarnessCompactArtifactSummary,
	HarnessCompactRecentArtifact,
	HarnessCompactSnapshot,
} from "./lifecycle-types";

export interface ValidationContext {
	repoRoot: string;
	config: HarnessConfig;
	dependencyRules: DependencyRules;
	fileSizeRules: FileSizeRules;
	namingRules: NamingRules;
	forbiddenRules: ForbiddenRules;
	reviewChecklist?: ReviewChecklist;
	goldenPrinciples?: GoldenPrinciplesRuleSet;
	docFreshnessRules?: DocFreshnessRuleSet;
	qualityDimensions?: QualityDimensionsConfig;
	observabilityProfiles?: ObservabilityProfilesConfig;
}

export type {
	CommandDefinition,
	CommandMode,
	CommandScope,
	CommandSuccessMode,
	CommandSurfaceFragment,
	CommandSurfaceRegistry,
	MissingPrereqBehavior,
	NormalizedCommandDefinition,
	WorkspaceKind,
} from "./command-types";
export type {
	DiscoveryAnswer,
	DiscoveryAnswerBatch,
	DiscoveryHistoryRecord,
	DiscoveryQuestion,
	DiscoveryQuestionPacket,
	DiscoveryReadiness,
	DiscoveryStage,
	DiscoveryState,
	DiscoveryStatus,
} from "./discovery-types";
export type {
	DocFreshnessFinding,
	DocFreshnessRule,
	DocFreshnessRuleSet,
	DocsReport,
	GoldenPrincipleFinding,
	GoldenPrincipleRule,
	GoldenPrinciplesRuleSet,
	ObservabilityProfile,
	ObservabilityProfilesConfig,
	QualityDimensionDefinition,
	QualityDimensionScore,
	QualityDimensionsConfig,
	QualityGradeDefinition,
	QualityReport,
	ReviewChecklist,
	ReviewChecklistCategory,
	ReviewChecklistRule,
	ReviewSeverity,
	SelfReviewCheckResult,
	SelfReviewFinding,
	SelfReviewReport,
} from "./policy-types";
export type {
	HarnessProgressSummary,
	HarnessRecoveryPoint,
	HarnessStatusSnapshot,
	HarnessTaskSummary,
} from "./status-types";
export type {
	TaskCheckResult,
	TaskContractArtifact,
	TaskEvaluationArtifact,
	TaskEvaluationFinding,
	TaskEvaluationGateAttempt,
	TaskEvaluationGateResult,
	TaskHandoffArtifact,
} from "./task-artifact-types";
