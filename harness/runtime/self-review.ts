import { writeReportArtifact } from "./report-artifacts";
import { repoRoot, run } from "./shared";
import type {
	ReviewChecklistRule,
	SelfReviewCheckResult,
	SelfReviewFinding,
	SelfReviewReport,
	ValidationContext,
} from "./types";
import { runLayerLint, validationContext } from "./validation";
import {
	collectFileSizeViolations,
	collectForbiddenPatternViolations,
} from "./validation-reports";

interface RuleEvaluation {
	result: SelfReviewCheckResult;
	findings: SelfReviewFinding[];
}

function changedFiles(root: string): string[] {
	const staged = run(
		"git",
		["-C", root, "diff", "--cached", "--name-only"],
		root,
	);
	const workingTree = (() => {
		try {
			return run("git", ["-C", root, "diff", "--name-only", "HEAD"], root);
		} catch {
			return "";
		}
	})();
	const untracked = run(
		"git",
		["-C", root, "ls-files", "--others", "--exclude-standard"],
		root,
	);
	return [...new Set(`${staged}\n${workingTree}\n${untracked}`.split(/\r?\n/))]
		.map((value) => value.trim())
		.filter(Boolean)
		.filter((value) => !value.startsWith(".harness/"));
}

function hasMatch(files: string[], pattern: RegExp): boolean {
	return files.some((file) => pattern.test(file));
}

function captureLayerLint(context: ValidationContext): {
	code: number;
	lines: string[];
} {
	const lines: string[] = [];
	const original = console.log;
	console.log = (...args: unknown[]) => {
		lines.push(args.join(" "));
	};
	try {
		return { code: runLayerLint(context), lines };
	} finally {
		console.log = original;
	}
}

function toFinding(
	rule: ReviewChecklistRule,
	message: string,
	files: string[],
): SelfReviewFinding {
	return {
		checkId: rule.id,
		label: rule.label,
		severity: rule.severity,
		message,
		files,
	};
}

function baseResult(
	rule: ReviewChecklistRule,
	status: SelfReviewCheckResult["status"],
	message: string,
	files: string[],
): SelfReviewCheckResult {
	return {
		checkId: rule.id,
		label: rule.label,
		severity: rule.severity,
		status,
		message,
		files,
	};
}

function evaluateRule(
	rule: ReviewChecklistRule,
	files: string[],
	context: ValidationContext,
): RuleEvaluation {
	const sourceChanged = hasMatch(files, /^(apps|packages|harness)\/.+/);
	const docsChanged = hasMatch(
		files,
		/^docs\/|(^|\/)AGENTS\.md$|(^|\/)(CODEX|CLAUDE)\.md$/,
	);
	const testsChanged = hasMatch(files, /\.(test|spec)\.[cm]?[jt]sx?$/);
	const workflowChanged = hasMatch(files, /^\.github\/workflows\/.+\.ya?ml$/);
	const rulesChanged = hasMatch(files, /^harness\/rules\/.+\.json$/);

	if (rule.rule === "changed-source-must-pass-layering") {
		if (!sourceChanged) {
			return {
				result: baseResult(
					rule,
					"skip",
					"No source-layer changes detected.",
					[],
				),
				findings: [],
			};
		}
		const lint = captureLayerLint(context);
		if (lint.code === 0) {
			return {
				result: baseResult(
					rule,
					"pass",
					"Layer boundaries passed for the current repository state.",
					files,
				),
				findings: [],
			};
		}
		const message =
			lint.lines.find((line) => line.startsWith("FAIL:")) ??
			"Layer boundary validation failed.";
		return {
			result: baseResult(rule, "fail", message, files),
			findings: [toFinding(rule, message, files)],
		};
	}

	if (rule.rule === "source-without-tests") {
		if (!sourceChanged || testsChanged) {
			return {
				result: baseResult(
					rule,
					"pass",
					sourceChanged
						? "Source and test changes were both detected."
						: "No source changes detected.",
					files,
				),
				findings: [],
			};
		}
		const message =
			"Source files changed without matching test-file changes. Confirm coverage is still adequate.";
		return {
			result: baseResult(rule, "warn", message, files),
			findings: [toFinding(rule, message, files)],
		};
	}

	if (rule.rule === "changed-files-size-limit") {
		const violations = collectFileSizeViolations(context, files);
		if (violations.length === 0) {
			return {
				result: baseResult(
					rule,
					"pass",
					"Changed text files stay within configured size limits.",
					files,
				),
				findings: [],
			};
		}
		return {
			result: baseResult(
				rule,
				"fail",
				`${violations.length} size-limit violation(s) found.`,
				violations.map((violation) => violation.file),
			),
			findings: violations.map((violation) =>
				toFinding(
					rule,
					`${violation.file} exceeds size limit (${violation.lines}/${violation.limit}).`,
					[violation.file],
				),
			),
		};
	}

	if (rule.rule === "changed-files-forbidden-patterns") {
		const violations = collectForbiddenPatternViolations(context, files);
		if (violations.length === 0) {
			return {
				result: baseResult(
					rule,
					"pass",
					"No forbidden patterns were found in changed files.",
					files,
				),
				findings: [],
			};
		}
		return {
			result: baseResult(
				rule,
				"fail",
				`${violations.length} forbidden pattern violation(s) found.`,
				[...new Set(violations.map((violation) => violation.file))],
			),
			findings: violations.map((violation) =>
				toFinding(
					rule,
					`${violation.file}:${violation.line} violates ${violation.ruleId}. ${violation.description}`,
					[violation.file],
				),
			),
		};
	}

	if (rule.rule === "source-without-docs") {
		if (!sourceChanged || docsChanged) {
			return {
				result: baseResult(
					rule,
					"pass",
					sourceChanged
						? "Documentation changed alongside source files."
						: "No source changes detected.",
					files,
				),
				findings: [],
			};
		}
		const message =
			"Source files changed without documentation updates. Confirm no docs drift was introduced.";
		return {
			result: baseResult(rule, "warn", message, files),
			findings: [toFinding(rule, message, files)],
		};
	}

	if (rule.rule === "workflow-without-docs") {
		if (!(workflowChanged || rulesChanged) || docsChanged) {
			return {
				result: baseResult(
					rule,
					"pass",
					workflowChanged || rulesChanged
						? "Operator docs changed alongside workflow or rule updates."
						: "No workflow or rule changes detected.",
					files,
				),
				findings: [],
			};
		}
		const message =
			"Workflow or rule changes were made without doc updates. Confirm the operator docs still match runtime behavior.";
		return {
			result: baseResult(rule, "warn", message, files),
			findings: [toFinding(rule, message, files)],
		};
	}

	return {
		result: baseResult(
			rule,
			"skip",
			`No runtime handler is registered for rule ${rule.rule}.`,
			[],
		),
		findings: [],
	};
}

export function buildSelfReviewReport(
	root: string = repoRoot(),
): SelfReviewReport {
	const files = changedFiles(root);
	const context = validationContext(root);
	if (files.length === 0) {
		return {
			version: "1.0.0",
			reviewedAt: new Date().toISOString(),
			filesReviewed: [],
			checks: [],
			findings: [],
			verdict: "pass",
		};
	}

	const checks: SelfReviewCheckResult[] = [];
	const findings: SelfReviewFinding[] = [];
	for (const category of context.reviewChecklist?.categories ?? []) {
		for (const rule of category.checks) {
			const evaluation = evaluateRule(rule, files, context);
			checks.push(evaluation.result);
			findings.push(...evaluation.findings);
		}
	}
	const hasBlocking = findings.some(
		(finding) => finding.severity === "blocking",
	);
	const hasWarnings = findings.some(
		(finding) => finding.severity === "warning",
	);
	return {
		version: "1.0.0",
		reviewedAt: new Date().toISOString(),
		filesReviewed: files,
		checks,
		findings,
		verdict: hasBlocking ? "fail" : hasWarnings ? "warn" : "pass",
	};
}

function renderReport(report: SelfReviewReport): string[] {
	const lines = [
		"harness self-review",
		"════════════════════════════════════════════",
	];
	if (report.filesReviewed.length === 0) {
		lines.push("INFO: No staged or working-tree changes detected.");
		return lines;
	}
	lines.push("Changed files:");
	for (const file of report.filesReviewed) {
		lines.push(`- ${file}`);
	}
	lines.push("", "Checklist:");
	for (const check of report.checks) {
		lines.push(
			`- [${check.status.toUpperCase()}] ${check.label}: ${check.message}`,
		);
	}
	if (report.findings.length === 0) {
		lines.push("", "PASS: Self-review checklist is clear.");
		return lines;
	}
	lines.push("", "Findings:");
	for (const finding of report.findings) {
		lines.push(
			`- [${finding.severity.toUpperCase()}] ${finding.checkId}: ${finding.message}`,
		);
	}
	return lines;
}

const root = repoRoot();
const report = buildSelfReviewReport(root);
const reportPath = writeReportArtifact(
	root,
	"reviews",
	"latest-report.json",
	report,
);
const jsonMode = process.argv.includes("--json");
const reportMode = process.argv.includes("--report");

if (jsonMode) {
	console.log(JSON.stringify({ ...report, reportPath }, null, 2));
	process.exit(report.verdict === "fail" ? 1 : 0);
}

for (const line of renderReport(report)) {
	console.log(line);
}
if (reportMode) {
	console.log("");
	console.log(`Report artifact: ${reportPath}`);
}

process.exit(report.verdict === "fail" ? 1 : 0);
