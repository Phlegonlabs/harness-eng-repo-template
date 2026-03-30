import path from "node:path";
import { exists, gitHasCommits, lastCommitUnix, markdownLinks } from "./shared";
import type {
	DocFreshnessFinding,
	DocsReport,
	ValidationContext,
} from "./types";

export function collectDocFreshnessFindings(
	context: ValidationContext,
): DocFreshnessFinding[] {
	const rules = context.docFreshnessRules?.rules ?? [];
	if (!gitHasCommits(context.repoRoot)) {
		return [
			{
				doc: "git-history",
				severity: "info",
				message:
					"Git history unavailable: repository has no commits yet. Doc freshness check skipped.",
			},
		];
	}

	const now = Math.floor(Date.now() / 1000);
	const findings: DocFreshnessFinding[] = [];
	for (const rule of rules) {
		const docCommit = lastCommitUnix(context.repoRoot, rule.doc);
		if (!docCommit) {
			findings.push({
				doc: rule.doc,
				severity: "error",
				message: "Tracked documentation surface is missing git history.",
				tracks: rule.tracks,
			});
			continue;
		}
		const daysSinceUpdated = Math.floor((now - docCommit) / 86400);
		if (daysSinceUpdated <= rule.max_drift_days) {
			continue;
		}
		findings.push({
			doc: rule.doc,
			severity: rule.severity,
			message: `Document is ${daysSinceUpdated} day(s) old; threshold is ${rule.max_drift_days} day(s).`,
			daysSinceUpdated,
			tracks: rule.tracks,
		});
	}
	return findings;
}

export function collectBrokenDocLinks(context: ValidationContext): Array<{
	file: string;
	link: string;
}> {
	if (!context.docFreshnessRules?.cross_link_validation.enabled) {
		return [];
	}
	const markdownFiles = [
		"AGENTS.md",
		"CLAUDE.md",
		"CODEX.md",
		"docs/product.md",
		"docs/architecture.md",
		"docs/progress.md",
		"docs/internal/agent-entry.md",
		"docs/internal/orchestrator-workflow.md",
	];
	const broken: Array<{ file: string; link: string }> = [];
	for (const relativePath of markdownFiles) {
		const absolutePath = path.join(context.repoRoot, relativePath);
		if (!exists(absolutePath)) continue;
		for (const link of markdownLinks(absolutePath)) {
			if (/^https?:\/\//.test(link) || link.startsWith("#")) continue;
			const linkPath = link.split("#")[0];
			if (!linkPath) continue;
			const resolved = linkPath.startsWith("/")
				? path.join(context.repoRoot, linkPath.slice(1))
				: path.resolve(path.dirname(absolutePath), linkPath);
			if (!exists(resolved)) {
				broken.push({ file: relativePath, link });
			}
		}
	}
	return broken;
}

export function buildDocsReport(context: ValidationContext): DocsReport {
	return {
		version: "1.0.0",
		generatedAt: new Date().toISOString(),
		freshness: collectDocFreshnessFindings(context),
		brokenLinks: collectBrokenDocLinks(context),
	};
}
