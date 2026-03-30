import { readFileSync } from "node:fs";
import path from "node:path";
import { globToRegex, isTextFile, lineCount, trackedFiles } from "./shared";
import type { ForbiddenRule, ValidationContext } from "./types";

export interface FileSizeViolation {
	file: string;
	lines: number;
	limit: number;
	reason: string;
}

export interface ForbiddenPatternViolation {
	ruleId: string;
	file: string;
	line: number;
	description: string;
	message: string;
}

function targetFiles(
	context: ValidationContext,
	candidates?: string[],
): string[] {
	if (candidates && candidates.length > 0) {
		return candidates;
	}
	return trackedFiles(context.repoRoot);
}

export function collectFileSizeViolations(
	context: ValidationContext,
	candidates?: string[],
): FileSizeViolation[] {
	return targetFiles(context, candidates).flatMap((relativePath) => {
		if (
			context.fileSizeRules.excluded_patterns.some((pattern) =>
				globToRegex(pattern).test(relativePath),
			)
		) {
			return [];
		}
		const absolutePath = path.join(context.repoRoot, relativePath);
		if (!isTextFile(absolutePath)) {
			return [];
		}
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
		if (lines <= limit) {
			return [];
		}
		return [{ file: relativePath, lines, limit, reason }];
	});
}

function ruleTargets(
	context: ValidationContext,
	rule: ForbiddenRule,
	candidates?: string[],
): string[] {
	return targetFiles(context, candidates).filter((relativePath) => {
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

export function collectForbiddenPatternViolations(
	context: ValidationContext,
	candidates?: string[],
): ForbiddenPatternViolation[] {
	const violations: ForbiddenPatternViolation[] = [];
	for (const rule of context.forbiddenRules.rules) {
		const regex = buildRuleRegex(rule.pattern);
		for (const relativePath of ruleTargets(context, rule, candidates)) {
			const absolutePath = path.join(context.repoRoot, relativePath);
			const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
			lines.forEach((line, index) => {
				if (!regex.test(line)) {
					regex.lastIndex = 0;
					return;
				}
				violations.push({
					ruleId: rule.id,
					file: relativePath,
					line: index + 1,
					description: rule.description,
					message: rule.message,
				});
				regex.lastIndex = 0;
			});
		}
	}
	return violations;
}
