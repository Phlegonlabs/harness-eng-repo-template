import { readFileSync } from "node:fs";
import path from "node:path";
import {
	collectBrokenDocLinks,
	collectDocFreshnessFindings,
} from "./docs-report";
import {
	check,
	exists,
	globToRegex,
	hasPlaceholderContent,
	isTextFile,
	lineCount,
	readJson,
	trackedFiles,
} from "./shared";
import type {
	DependencyRules,
	DocFreshnessRuleSet,
	FileSizeRules,
	ForbiddenRule,
	ForbiddenRules,
	GoldenPrinciplesRuleSet,
	HarnessConfig,
	NamingRules,
	ObservabilityProfilesConfig,
	QualityDimensionsConfig,
	ReviewChecklist,
	ValidationContext,
} from "./types";
import { runLayerLint } from "./validation-layering";

export { getLayerForPath, runLayerLint } from "./validation-layering";

export function validationContext(root: string): ValidationContext {
	return {
		repoRoot: root,
		config: readJson<HarnessConfig>(path.join(root, "harness/config.json")),
		dependencyRules: readJson<DependencyRules>(
			path.join(root, "harness/rules/dependency-layers.json"),
		),
		fileSizeRules: readJson<FileSizeRules>(
			path.join(root, "harness/rules/file-size-limits.json"),
		),
		namingRules: readJson<NamingRules>(
			path.join(root, "harness/rules/naming-conventions.json"),
		),
		forbiddenRules: readJson<ForbiddenRules>(
			path.join(root, "harness/rules/forbidden-patterns.json"),
		),
		reviewChecklist: readJson<ReviewChecklist>(
			path.join(root, "harness/rules/review-checklist.json"),
		),
		goldenPrinciples: readJson<GoldenPrinciplesRuleSet>(
			path.join(root, "harness/rules/golden-principles.json"),
		),
		docFreshnessRules: readJson<DocFreshnessRuleSet>(
			path.join(root, "harness/rules/doc-freshness.json"),
		),
		qualityDimensions: readJson<QualityDimensionsConfig>(
			path.join(root, "harness/rules/quality-dimensions.json"),
		),
		observabilityProfiles: readJson<ObservabilityProfilesConfig>(
			path.join(root, "harness/rules/observability-profiles.json"),
		),
	};
}

export function runFileSizeLint(context: ValidationContext): number {
	let errors = 0;
	for (const relativePath of trackedFiles(context.repoRoot)) {
		if (
			context.fileSizeRules.excluded_patterns.some((pattern) =>
				globToRegex(pattern).test(relativePath),
			)
		)
			continue;
		const absolutePath = path.join(context.repoRoot, relativePath);
		if (!isTextFile(absolutePath)) continue;
		let limit = context.fileSizeRules.default_limit;
		let reason = "Files should be focused and composable.";
		for (const rule of context.fileSizeRules.rules) {
			if (globToRegex(rule.pattern).test(relativePath)) {
				limit = rule.limit;
				reason = rule.reason;
				break;
			}
		}
		const lines = lineCount(absolutePath);
		if (lines > limit) {
			errors += 1;
			console.log(`FILE TOO LARGE: ${relativePath}`);
			console.log(`  Lines: ${lines} (limit: ${limit})`);
			console.log(`  Reason: ${reason}`);
			console.log("");
		}
	}
	console.log(
		errors > 0
			? `FAIL: ${errors} file(s) exceed size limits.`
			: "PASS: All files within size limits.",
	);
	return errors > 0 ? 1 : 0;
}

export function runNamingLint(context: ValidationContext): number {
	let errors = 0;
	for (const relativePath of trackedFiles(context.repoRoot)) {
		if (
			context.namingRules.excluded_patterns.some((pattern) =>
				globToRegex(pattern).test(relativePath),
			)
		)
			continue;
		const rule = context.namingRules.rules.find((entry) =>
			globToRegex(entry.path_pattern).test(relativePath),
		);
		if (!rule) continue;
		const fileName = path
			.basename(relativePath, path.extname(relativePath))
			.replace(/\.(test|spec|d)$/, "");
		if (
			!new RegExp(context.namingRules.case_patterns["kebab-case"]).test(
				fileName,
			)
		) {
			errors += 1;
			console.log(`NAMING VIOLATION: ${relativePath}`);
			console.log("  Expected kebab-case filename.");
			console.log(`  Message: ${rule.violation_message}`);
			console.log("");
		}
	}
	console.log(
		errors > 0
			? `FAIL: ${errors} naming convention violation(s) found.`
			: "PASS: All file names follow naming conventions.",
	);
	return errors > 0 ? 1 : 0;
}

function ruleTargets(root: string, rule: ForbiddenRule): string[] {
	return trackedFiles(root).filter((relativePath) => {
		const matchesApply = rule.apply_to.some((pattern) =>
			globToRegex(pattern).test(relativePath),
		);
		if (!matchesApply) return false;
		return !(rule.exclude ?? []).some((pattern) =>
			globToRegex(pattern).test(relativePath),
		);
	});
}

function buildRuleRegex(pattern: string): RegExp {
	let flags = "gm";
	let source = pattern;
	if (source.startsWith("(?i)")) {
		source = source.slice(4);
		flags += "i";
	}
	return new RegExp(source, flags);
}

export function runForbiddenLint(context: ValidationContext): number {
	let errors = 0;
	for (const rule of context.forbiddenRules.rules) {
		const regex = buildRuleRegex(rule.pattern);
		for (const relativePath of ruleTargets(context.repoRoot, rule)) {
			const absolutePath = path.join(context.repoRoot, relativePath);
			const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
			lines.forEach((line, index) => {
				if (regex.test(line)) {
					errors += 1;
					console.log(
						`FORBIDDEN PATTERN [${rule.id}]: ${relativePath}:${index + 1}`,
					);
					console.log(`  Violation: ${rule.description}`);
					console.log(`  Fix: ${rule.message}`);
					console.log("");
				}
				regex.lastIndex = 0;
			});
		}
	}
	console.log(
		errors > 0
			? `FAIL: ${errors} forbidden pattern(s) found.`
			: "PASS: No forbidden patterns found.",
	);
	return errors > 0 ? 1 : 0;
}

export function runDocsFreshnessLint(context: ValidationContext): number {
	const findings = collectDocFreshnessFindings(context);
	if (
		findings.length === 1 &&
		findings[0].doc === "git-history" &&
		findings[0].severity === "info"
	) {
		check("WARN", findings[0].message);
		return 0;
	}
	let errors = 0;
	let warnings = 0;
	for (const finding of findings) {
		console.log(`STALE DOC: ${finding.doc}`);
		console.log(`  Severity: ${finding.severity}`);
		console.log(`  Message: ${finding.message}`);
		if (finding.tracks?.length) {
			console.log(`  Tracks: ${finding.tracks.join(", ")}`);
		}
		console.log("");
		if (finding.severity === "error") {
			errors += 1;
		} else {
			warnings += 1;
		}
	}
	if (errors > 0) {
		console.log(`FAIL: ${errors} doc freshness error(s) found.`);
		return 1;
	}
	console.log(
		warnings > 0
			? `WARN: ${warnings} doc freshness warning(s) found.`
			: "PASS: All tracked docs satisfy freshness rules.",
	);
	return 0;
}

export function runRequiredFilesTest(context: ValidationContext): number {
	let errors = 0;
	for (const relativePath of context.config.required_files) {
		if (exists(path.join(context.repoRoot, relativePath))) {
			check("PASS", relativePath);
		} else {
			check("FAIL", `Missing required file: ${relativePath}`);
			errors += 1;
		}
	}
	for (const workspace of context.config.default_workspaces) {
		const relativePath = `${workspace}/AGENTS.md`;
		if (exists(path.join(context.repoRoot, relativePath))) {
			check("PASS", relativePath);
		} else {
			check("FAIL", `Missing workspace AGENTS.md: ${relativePath}`);
			errors += 1;
		}
	}
	console.log(
		errors > 0
			? `FAIL: ${errors} required file(s) missing.`
			: "PASS: All required files present.",
	);
	return errors > 0 ? 1 : 0;
}

export function runArchitectureTest(context: ValidationContext): number {
	let errors = 0;
	if (
		!exists(
			path.join(context.repoRoot, "docs/internal/orchestrator-workflow.md"),
		)
	) {
		check("FAIL", "Missing orchestrator workflow doc.");
		errors += 1;
	}
	if (
		!hasPlaceholderContent(
			path.join(context.repoRoot, "docs/architecture.md"),
		) &&
		!readFileSync(
			path.join(context.repoRoot, "docs/architecture.md"),
			"utf8",
		).includes("Dependency Layer Model")
	) {
		check(
			"FAIL",
			"Architecture doc does not describe the dependency layer model.",
		);
		errors += 1;
	}
	if (!exists(path.join(context.repoRoot, "docs/progress.md"))) {
		check("FAIL", "Missing docs/progress.md.");
		errors += 1;
	}
	errors += runLayerLint(context);
	console.log(
		errors > 0
			? `FAIL: ${errors} architectural compliance check(s) failed.`
			: "PASS: Architecture compliance checks passed.",
	);
	return errors > 0 ? 1 : 0;
}

export function runDocLinksTest(context: ValidationContext): number {
	let errors = 0;
	const brokenLinks = collectBrokenDocLinks(context);
	for (const brokenLink of brokenLinks) {
		errors += 1;
		console.log(`BROKEN LINK: ${brokenLink.file}`);
		console.log(`  Link: ${brokenLink.link}`);
		console.log("");
	}
	console.log(
		errors > 0
			? `FAIL: ${errors} broken internal link(s) found.`
			: "PASS: All internal document links resolve correctly.",
	);
	return errors > 0 ? 1 : 0;
}

const TEMPLATE_IDENTITY_TARGETS = [
	".env.example",
	".github/CODEOWNERS",
	"LICENSE",
	"README.md",
	"apps/api/AGENTS.md",
	"apps/api/package.json",
	"apps/web/AGENTS.md",
	"apps/web/package.json",
	"docs/architecture.md",
	"docs/internal/observability.md",
	"docs/product.md",
	"docs/progress.md",
	"harness/rules/forbidden-patterns.json",
	"package.json",
	"packages/shared/AGENTS.md",
	"packages/shared/package.json",
] as const;

const TEMPLATE_IDENTITY_NEEDLES = [
	"harness-template",
	"@harness-template/",
	"@your-org/engineering",
] as const;

export function runTemplateIdentityTest(context: ValidationContext): number {
	if (context.config.project_name === "harness-template") {
		console.log(
			"PASS: Template identity scan skipped for the pre-init scaffold.",
		);
		return 0;
	}

	let errors = 0;
	for (const relativePath of TEMPLATE_IDENTITY_TARGETS) {
		const absolutePath = path.join(context.repoRoot, relativePath);
		if (!exists(absolutePath)) continue;
		const content = readFileSync(absolutePath, "utf8");
		for (const needle of TEMPLATE_IDENTITY_NEEDLES) {
			if (!content.includes(needle)) continue;
			errors += 1;
			console.log(`TEMPLATE IDENTITY LEAK: ${relativePath}`);
			console.log(`  Residual token: ${needle}`);
			console.log("");
		}
	}

	console.log(
		errors > 0
			? `FAIL: ${errors} template identity leak(s) found after initialization.`
			: "PASS: No template identity leaks found in project-facing surfaces.",
	);
	return errors > 0 ? 1 : 0;
}

export {
	runConsistencyScan,
	runDriftScan,
	runOrphanScan,
} from "./validation-entropy";
