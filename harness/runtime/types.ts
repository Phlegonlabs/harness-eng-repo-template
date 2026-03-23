export interface HarnessConfig {
  version: string;
  level: number;
  project_name: string;
  layers: string[];
  validation: {
    structural_tests: boolean;
    linters: boolean;
    entropy_scans: boolean;
    doc_freshness_days: number;
  };
  commit_format: string;
  required_files: string[];
}

export interface LayerRule {
  name: string;
  index: number;
  directories: string[];
  allowed_imports: string[];
}

export interface DependencyRules {
  internal_import_roots: string[];
  internal_import_aliases: Record<string, string>;
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
}

export interface TaskRecord {
  id: string;
  milestoneId: string;
  title: string;
  kind: string;
  status: string;
  dependsOn: string[];
  affectedFilesOrAreas: string[];
  requiredSkills: string[];
  validationChecks: string[];
}

export interface ActiveWorktreeRecord {
  milestoneId: string;
  worktree: string;
  branch: string;
  status: string;
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
  };
}

export interface SkillRegistry {
  strategy: string;
  phases: Record<string, string[]>;
  taskKinds: Record<string, string[]>;
}

export type DiscoveryStage = "PRD" | "ARCHITECTURE" | "COMPLETE";
export type DiscoveryStatus = "idle" | "collecting" | "ready_for_plan";

export interface DiscoveryQuestion {
  id: string;
  stage: Exclude<DiscoveryStage, "COMPLETE">;
  prompt: string;
  docTargets: string[];
  expectedAnswerShape: string;
}

export interface DiscoveryQuestionPacket {
  stage: Exclude<DiscoveryStage, "COMPLETE">;
  questionIds: string[];
  questions: DiscoveryQuestion[];
  completionCriteria: {
    productReady: boolean;
    architectureReady: boolean;
    planReady: boolean;
  };
}

export interface DiscoveryAnswer {
  id: string;
  value: string;
}

export interface DiscoveryAnswerBatch {
  answers: DiscoveryAnswer[];
}

export interface DiscoveryHistoryRecord {
  stage: DiscoveryStage;
  questionIds: string[];
  answeredAt: string;
}

export interface DiscoveryReadiness {
  productReady: boolean;
  architectureReady: boolean;
  planReady: boolean;
}

export interface DiscoveryState {
  stage: DiscoveryStage;
  status: DiscoveryStatus;
  currentQuestionIds: string[];
  answered: Record<string, string>;
  history: DiscoveryHistoryRecord[];
  readiness: DiscoveryReadiness;
  lastUpdatedAt: string | null;
}

export interface ValidationContext {
  repoRoot: string;
  config: HarnessConfig;
  dependencyRules: DependencyRules;
  fileSizeRules: FileSizeRules;
  namingRules: NamingRules;
  forbiddenRules: ForbiddenRules;
}
