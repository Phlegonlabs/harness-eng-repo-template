import type { EvaluationGateCategory, TaskEvaluationGate } from "./types";

function slugPart(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function inferGateCategory(command: string): EvaluationGateCategory {
	if (command.includes("typecheck")) return "typecheck";
	if (command.includes("harness:lint")) return "lint";
	if (command.includes("harness:structural")) return "structural";
	if (
		command.includes(" test") ||
		command.startsWith("test ") ||
		command.includes("bun run test")
	) {
		return "test";
	}
	if (command.includes("harness:entropy")) return "entropy";
	if (command.includes("harness:docs")) return "docs";
	if (command.includes("harness:quality")) return "quality";
	if (command.includes("harness:health") || command.includes("harness:logs")) {
		return "runtime";
	}
	if (command.includes("harness:validate")) return "validation";
	return "custom";
}

function defaultGateLabel(command: string, index: number): string {
	const category = inferGateCategory(command);
	switch (category) {
		case "typecheck":
			return "Typecheck";
		case "lint":
			return "Lint";
		case "test":
			return "Tests";
		case "structural":
			return "Structural";
		case "entropy":
			return "Entropy";
		case "docs":
			return "Documentation";
		case "quality":
			return "Quality";
		case "runtime":
			return "Runtime Health";
		case "validation":
			return "Repository Validation";
		default:
			return `Gate ${String(index + 1).padStart(2, "0")}`;
	}
}

function defaultBlocking(command: string): boolean {
	const category = inferGateCategory(command);
	return !["entropy", "quality"].includes(category);
}

function buildGateId(command: string, index: number): string {
	const category = inferGateCategory(command);
	const prefix = category === "custom" ? "gate" : slugPart(category);
	return `${prefix}-${String(index + 1).padStart(2, "0")}`;
}

export function normalizeTaskEvaluationGates(
	validationChecks: string[],
	gates: TaskEvaluationGate[],
): TaskEvaluationGate[] {
	if (gates.length > 0) {
		return gates.map((gate, index) => ({
			id: gate.id || buildGateId(gate.command, index),
			label: gate.label || defaultGateLabel(gate.command, index),
			command: gate.command,
			category: gate.category || inferGateCategory(gate.command),
			blocking: gate.blocking ?? defaultBlocking(gate.command),
			source: gate.source ?? "task",
		}));
	}
	return validationChecks.map((command, index) => ({
		id: buildGateId(command, index),
		label: defaultGateLabel(command, index),
		command,
		category: inferGateCategory(command),
		blocking: defaultBlocking(command),
		source: "task",
	}));
}

export function skillExitGate(
	command: string,
	index: number,
): TaskEvaluationGate {
	return {
		id: `skill-exit-${String(index + 1).padStart(2, "0")}`,
		label: `Skill Exit ${String(index + 1).padStart(2, "0")}`,
		command,
		category: "skill-exit",
		blocking: true,
		source: "skill-exit",
	};
}

export function defaultTaskAcceptanceCriteria(title: string): string[] {
	return [
		`${title} is implemented within the task contract scope.`,
		"All blocking evaluation gates pass.",
		"No unresolved blocker findings remain in the latest evaluation artifact.",
	];
}
