import path from "node:path";
import { readJson } from "./shared";
import type {
	ResolvedSkillCommand,
	ResolvedSkillSelection,
	SkillMetadata,
	SkillRegistry,
} from "./skill-types";
import type { TaskRecord } from "./types";

function conditionValue(rawValue: string): boolean | string {
	const trimmed = rawValue.trim();
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	return trimmed.replace(/^['"]|['"]$/g, "");
}

function taskConditionContext(task: TaskRecord): Record<string, unknown> {
	return {
		...task,
		touchesUnknownArea: task.affectedFilesOrAreas.length === 0,
		requiresValidation: task.validationChecks.length > 0,
		isReadyForHandoff:
			task.status === "evaluation_pending" || task.status === "done",
		involvesBugFix:
			task.kind === "debugging" ||
			/\b(bug|debug|fix|regression|incident)\b/i.test(task.title),
	};
}

function conditionMatches(condition: string, task: TaskRecord): boolean {
	const match = condition.match(/^task\.([a-zA-Z0-9_]+)\s*==\s*(.+)$/);
	if (!match) return false;
	const [, field, rawValue] = match;
	const expected = conditionValue(rawValue);
	return taskConditionContext(task)[field] === expected;
}

function registry(root: string): SkillRegistry {
	return readJson<SkillRegistry>(
		path.join(root, "harness/skills/registry.json"),
	);
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

function addReason(
	target: Record<string, string[]>,
	skill: string,
	reason: string,
): void {
	target[skill] = unique([...(target[skill] ?? []), reason]);
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, "/");
}

function escapeRegExp(value: string): string {
	return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globPatternToRegExp(pattern: string): RegExp {
	let source = "";
	for (let index = 0; index < pattern.length; index += 1) {
		const char = pattern[index];
		const next = pattern[index + 1];
		if (char === "*" && next === "*") {
			source += ".*";
			index += 1;
			continue;
		}
		if (char === "*") {
			source += "[^/]*";
			continue;
		}
		if (char === "?") {
			source += "[^/]";
			continue;
		}
		source += escapeRegExp(char);
	}
	return new RegExp(`^${source}$`);
}

function matchesFilePattern(pattern: string, candidate: string): boolean {
	return globPatternToRegExp(normalizePath(pattern)).test(
		normalizePath(candidate),
	);
}

function matchedFilePatterns(
	task: TaskRecord,
	metadata: SkillMetadata | undefined,
): string[] {
	if (
		!metadata?.filePatterns?.length ||
		task.affectedFilesOrAreas.length === 0
	) {
		return [];
	}
	return metadata.filePatterns.filter((pattern) =>
		task.affectedFilesOrAreas.some((candidate) =>
			matchesFilePattern(pattern, candidate),
		),
	);
}

function resolvedMetadataCommands(
	skills: string[],
	metadata: Record<string, SkillMetadata>,
	key: "exitCriteria" | "guardrails",
): string[] {
	return unique(skills.flatMap((skill) => metadata[skill]?.[key] ?? []));
}

function resolvedExitCriteria(
	skills: string[],
	metadata: Record<string, SkillMetadata>,
): ResolvedSkillCommand[] {
	const commands = new Map<string, Set<string>>();
	for (const skill of skills) {
		for (const command of metadata[skill]?.exitCriteria ?? []) {
			const linkedSkills = commands.get(command) ?? new Set<string>();
			linkedSkills.add(skill);
			commands.set(command, linkedSkills);
		}
	}
	return [...commands.entries()].map(([command, linkedSkills]) => ({
		command,
		skills: [...linkedSkills],
	}));
}

export function resolveTaskSkills(
	root: string,
	phase: string,
	task: TaskRecord,
): ResolvedSkillSelection {
	const policy = registry(root);
	const routing = policy.routing ?? {};
	const weights = routing.weights ?? {};
	const reasonLabels = policy.routing?.reasonLabels ?? {};
	const metadata = policy.skillMetadata ?? {};
	const reasons: Record<string, string[]> = {};

	for (const skill of task.requiredSkills) {
		addReason(reasons, skill, reasonLabels.required ?? "task-required");
	}
	for (const skill of policy.phases[phase] ?? []) {
		addReason(reasons, skill, reasonLabels.phase ?? `phase:${phase}`);
	}
	for (const skill of policy.taskKinds[task.kind] ?? []) {
		addReason(reasons, skill, reasonLabels.taskKind ?? `kind:${task.kind}`);
	}
	for (const rule of policy.conditions ?? []) {
		if (!conditionMatches(rule.when, task)) continue;
		for (const skill of rule.load) {
			addReason(
				reasons,
				skill,
				reasonLabels[rule.when] ?? `condition:${rule.when}`,
			);
		}
	}
	for (const [skill, definition] of Object.entries(metadata)) {
		for (const pattern of matchedFilePatterns(task, definition)) {
			const label = reasonLabels.filePattern ?? "file-pattern";
			addReason(reasons, skill, `${label}:${pattern}`);
		}
	}

	const ordered = Object.keys(reasons).sort((left, right) => {
		const requiredDelta =
			Number(task.requiredSkills.includes(right)) -
			Number(task.requiredSkills.includes(left));
		if (routing.preserveRequiredSkills && requiredDelta !== 0) {
			return requiredDelta;
		}
		return (weights[right] ?? 0) - (weights[left] ?? 0);
	});
	const maxLoadedSkills = routing.maxLoadedSkills ?? ordered.length;
	const loaded = ordered.slice(0, maxLoadedSkills);
	return {
		loaded,
		reasons: Object.fromEntries(loaded.map((skill) => [skill, reasons[skill]])),
		guardrails: resolvedMetadataCommands(loaded, metadata, "guardrails"),
		exitCriteria: resolvedExitCriteria(loaded, metadata),
	};
}

export function defaultValidationChecks(root: string, kind: string): string[] {
	const policy = registry(root);
	return (
		policy.validation?.defaultChecksByKind?.[kind] ??
		(kind === "research" ? [] : ["bun run harness:validate --quiet-success"])
	);
}
