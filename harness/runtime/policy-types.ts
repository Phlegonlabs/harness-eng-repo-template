export type ReviewSeverity = "blocking" | "warning" | "info";

export interface ReviewChecklistRule {
	id: string;
	label: string;
	severity: ReviewSeverity;
	rule: string;
}

export interface ReviewChecklistCategory {
	name: string;
	checks: ReviewChecklistRule[];
}

export interface ReviewChecklist {
	categories: ReviewChecklistCategory[];
}

export interface SelfReviewFinding {
	checkId: string;
	label: string;
	severity: ReviewSeverity;
	message: string;
	files: string[];
}

export interface SelfReviewCheckResult {
	checkId: string;
	label: string;
	severity: ReviewSeverity;
	status: "pass" | "warn" | "fail" | "skip";
	message: string;
	files: string[];
}

export interface SelfReviewReport {
	version: string;
	reviewedAt: string;
	filesReviewed: string[];
	checks: SelfReviewCheckResult[];
	findings: SelfReviewFinding[];
	verdict: "pass" | "warn" | "fail";
}

export interface GoldenPrincipleRule {
	id: string;
	name: string;
	description: string;
	severity: "warning" | "error";
	pattern: string;
	apply_to: string[];
	exclude?: string[];
}

export interface GoldenPrinciplesRuleSet {
	principles: GoldenPrincipleRule[];
}

export interface GoldenPrincipleFinding {
	principleId: string;
	name: string;
	severity: "warning" | "error";
	file: string;
	line: number;
	message: string;
}

export interface DocFreshnessRule {
	doc: string;
	tracks: string[];
	max_drift_days: number;
	severity: "info" | "warning" | "error";
}

export interface DocFreshnessRuleSet {
	rules: DocFreshnessRule[];
	cross_link_validation: {
		enabled: boolean;
		check_internal_links: boolean;
	};
}

export interface DocFreshnessFinding {
	doc: string;
	severity: "info" | "warning" | "error";
	message: string;
	daysSinceUpdated?: number;
	tracks?: string[];
}

export interface DocsReport {
	version: "1.0.0";
	generatedAt: string;
	freshness: DocFreshnessFinding[];
	brokenLinks: Array<{
		file: string;
		link: string;
	}>;
}

export interface QualityDimensionDefinition {
	name: string;
	label: string;
	weight: number;
	measurement: string;
}

export interface QualityGradeDefinition {
	min: number;
	label: string;
}

export interface QualityDimensionsConfig {
	dimensions: QualityDimensionDefinition[];
	grading: Record<string, QualityGradeDefinition>;
}

export interface QualityDimensionScore {
	name: string;
	label: string;
	score: number;
	weight: number;
	detail: string;
}

export interface QualityReport {
	version: "1.0.0";
	generatedAt: string;
	overallScore: number;
	overallGrade: string;
	dimensions: QualityDimensionScore[];
}

export interface ObservabilityProfile {
	name: string;
	description?: string;
	healthEndpoint?: string;
	healthTimeoutMs?: number;
	logFiles?: string[];
}

export interface ObservabilityProfilesConfig {
	profiles: ObservabilityProfile[];
}
