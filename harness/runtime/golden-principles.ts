import { readFileSync } from "node:fs";
import path from "node:path";
import { globToRegex, trackedFiles } from "./shared";
import type {
	GoldenPrincipleFinding,
	GoldenPrinciplesRuleSet,
	ValidationContext,
} from "./types";

function targetsForRule(
	root: string,
	rule: GoldenPrinciplesRuleSet["principles"][number],
): string[] {
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

export function collectGoldenPrincipleFindings(
	context: ValidationContext,
): GoldenPrincipleFinding[] {
	const rules = context.goldenPrinciples?.principles ?? [];
	const findings: GoldenPrincipleFinding[] = [];
	for (const rule of rules) {
		const regex = new RegExp(rule.pattern, "g");
		for (const relativePath of targetsForRule(context.repoRoot, rule)) {
			const absolutePath = path.join(context.repoRoot, relativePath);
			const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
			lines.forEach((line, index) => {
				if (!regex.test(line)) {
					regex.lastIndex = 0;
					return;
				}
				findings.push({
					principleId: rule.id,
					name: rule.name,
					severity: rule.severity,
					file: relativePath,
					line: index + 1,
					message: rule.description,
				});
				regex.lastIndex = 0;
			});
		}
	}
	return findings;
}
