import { createTaskRecord } from "./planning-state";
import { defaultValidationChecks } from "./skill-routing";
import type { HarnessConfig, MilestoneRecord, TaskRecord } from "./types";

const KIND_PATTERNS: Array<{ pattern: RegExp; kind: string }> = [
	{
		pattern: /\b(debug\w*|bug|fix|regression|incident|triage)\b/i,
		kind: "debugging",
	},
	{
		pattern: /\b(tests?|testing|validat\w+|verify|assert)\b/i,
		kind: "testing",
	},
	{ pattern: /\b(deploy\w*|release|publish)\b/i, kind: "deployment" },
	{ pattern: /\b(review\w*|audit|inspect)\b/i, kind: "review" },
	{
		pattern: /\b(research|investigat\w+|explor\w+|analyz\w+|design)\b/i,
		kind: "research",
	},
];

const SKILLS_BY_KIND: Record<string, string[]> = {
	research: ["skills/research/SKILL.md"],
	implementation: ["skills/implementation/SKILL.md"],
	testing: ["skills/testing/SKILL.md", "skills/code-review/SKILL.md"],
	debugging: ["skills/debugging/SKILL.md", "skills/code-review/SKILL.md"],
	review: ["skills/code-review/SKILL.md"],
	deployment: ["skills/deployment/SKILL.md"],
};

function inferKind(hint: string): string {
	for (const { pattern, kind } of KIND_PATTERNS) {
		if (pattern.test(hint)) return kind;
	}
	return "implementation";
}

function detectAreas(hint: string, workspaces: string[]): string[] {
	return workspaces.filter(
		(ws) => hint.includes(ws) || hint.includes(ws.split("/").pop() ?? ""),
	);
}

function tasksFromHints(
	root: string,
	suffix: string,
	milestone: MilestoneRecord,
	hints: string[],
	workspaces: string[],
): TaskRecord[] {
	const tasks: TaskRecord[] = [];
	let seq = 1;
	const researchId = `T${suffix}${String(seq).padStart(2, "0")}`;
	tasks.push(
		createTaskRecord({
			id: researchId,
			milestoneId: milestone.id,
			title: `Refine milestone design for ${milestone.title}`,
			kind: "research",
			status: "pending",
			dependsOn: [],
			affectedFilesOrAreas: [],
			requiredSkills: ["skills/research/SKILL.md"],
			validationChecks: [],
		}),
	);
	seq += 1;

	for (const hint of hints) {
		const kind = inferKind(hint);
		const id = `T${suffix}${String(seq).padStart(2, "0")}`;
		const prevId = tasks[tasks.length - 1].id;
		tasks.push(
			createTaskRecord({
				id,
				milestoneId: milestone.id,
				title: hint,
				kind,
				status: "pending",
				dependsOn: [prevId],
				affectedFilesOrAreas: detectAreas(hint, workspaces),
				requiredSkills: SKILLS_BY_KIND[kind] ?? [
					"skills/implementation/SKILL.md",
				],
				validationChecks: defaultValidationChecks(root, kind),
			}),
		);
		seq += 1;
	}

	const valId = `T${suffix}${String(seq).padStart(2, "0")}`;
	const lastId = tasks[tasks.length - 1].id;
	tasks.push(
		createTaskRecord({
			id: valId,
			milestoneId: milestone.id,
			title: `Validate ${milestone.title}`,
			kind: "testing",
			status: "pending",
			dependsOn: [lastId],
			affectedFilesOrAreas: [],
			requiredSkills: [
				"skills/testing/SKILL.md",
				"skills/code-review/SKILL.md",
			],
			validationChecks: defaultValidationChecks(root, "testing"),
		}),
	);

	return tasks;
}

function fallbackTasks(
	root: string,
	suffix: string,
	milestone: MilestoneRecord,
): TaskRecord[] {
	return [
		createTaskRecord({
			id: `T${suffix}01`,
			milestoneId: milestone.id,
			title: `Refine milestone design for ${milestone.title}`,
			kind: "research",
			status: "pending",
			dependsOn: [],
			affectedFilesOrAreas: [],
			requiredSkills: ["skills/research/SKILL.md"],
			validationChecks: [],
		}),
		createTaskRecord({
			id: `T${suffix}02`,
			milestoneId: milestone.id,
			title: `Implement ${milestone.title}`,
			kind: "implementation",
			status: "pending",
			dependsOn: [`T${suffix}01`],
			affectedFilesOrAreas: [],
			requiredSkills: ["skills/implementation/SKILL.md"],
			validationChecks: defaultValidationChecks(root, "implementation"),
		}),
		createTaskRecord({
			id: `T${suffix}03`,
			milestoneId: milestone.id,
			title: `Validate ${milestone.title}`,
			kind: "testing",
			status: "pending",
			dependsOn: [`T${suffix}02`],
			affectedFilesOrAreas: [],
			requiredSkills: [
				"skills/testing/SKILL.md",
				"skills/code-review/SKILL.md",
			],
			validationChecks: defaultValidationChecks(root, "testing"),
		}),
	];
}

export function defaultTasks(
	root: string,
	milestones: MilestoneRecord[],
	config?: HarnessConfig,
): TaskRecord[] {
	const workspaces = config?.default_workspaces ?? [];
	return milestones.flatMap((milestone) => {
		const suffix = milestone.id.slice(1);
		if (milestone.taskHints.length > 0) {
			return tasksFromHints(
				root,
				suffix,
				milestone,
				milestone.taskHints,
				workspaces,
			);
		}
		return fallbackTasks(root, suffix, milestone);
	});
}
