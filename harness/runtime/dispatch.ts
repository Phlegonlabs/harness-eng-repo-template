import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadState, saveState } from "./planning";
import { repoRelative, repoRoot, writeJson } from "./shared";
import type { DispatchPacketArtifact, DispatchResultArtifact } from "./types";

function packetId(role: DispatchPacketArtifact["role"]): string {
	return `${role}-${Date.now()}`;
}

function packetPath(root: string, id: string): string {
	return path.join(root, ".harness", "dispatch", `${id}.json`);
}

function resultPath(root: string, id: string): string {
	return path.join(root, ".harness", "dispatch-results", `${id}.json`);
}

function activeTask(root: string) {
	const state = loadState(root);
	return (
		state.tasks.find((task) =>
			["in_progress", "evaluation_pending"].includes(task.status),
		) ?? null
	);
}

function artifactInputs(root: string): string[] {
	const state = loadState(root);
	const task = activeTask(root);
	return [
		state.compact.latestMarkdownPath,
		task?.artifacts.contractPath ?? null,
		task?.artifacts.latestEvaluationPath ?? null,
		task?.artifacts.latestHandoffPath ?? null,
	].filter((value): value is string => Boolean(value));
}

function defaultAllowedTools(role: DispatchPacketArtifact["role"]): string[] {
	if (role === "planner") {
		return ["status", "compact", "read-only search", "docs"];
	}
	if (role === "worker") {
		return ["task artifacts", "tests", "diff review"];
	}
	return ["search", "read-only file inspection", "artifact review"];
}

export function prepareDispatch(options: {
	root?: string;
	role: DispatchPacketArtifact["role"];
}): { packetPath: string; packet: DispatchPacketArtifact } {
	const root = options.root ?? repoRoot();
	const state = loadState(root);
	const task = activeTask(root);
	const id = packetId(options.role);
	const packet: DispatchPacketArtifact = {
		version: "1.0.0",
		packetId: id,
		role: options.role,
		goal: task?.title ?? "Support the current harness execution state.",
		scope:
			task?.affectedFilesOrAreas.join(", ") ||
			(task ? `Task ${task.id}` : "Repository runtime support"),
		allowedTools: defaultAllowedTools(options.role),
		contextBudget: options.role === "sidecar" ? 4000 : 8000,
		returnFormat: "condensed",
		artifactInputs: artifactInputs(root),
		createdAt: new Date().toISOString(),
		taskId: task?.id ?? null,
		milestoneId: task?.milestoneId ?? null,
	};
	const target = packetPath(root, id);
	writeJson(target, packet);
	if (options.role === "sidecar") {
		state.dispatch.queuedSidecars = [
			...new Set([...state.dispatch.queuedSidecars, id]),
		];
	}
	state.dispatch.latestPacketPath = repoRelative(root, target);
	saveState(root, state);
	return { packetPath: state.dispatch.latestPacketPath, packet };
}

export function completeDispatch(options: {
	root?: string;
	packetId: string;
	resultPath: string;
}): { storedResultPath: string; result: DispatchResultArtifact } {
	const root = options.root ?? repoRoot();
	if (!existsSync(options.resultPath)) {
		throw new Error(`Dispatch result file not found: ${options.resultPath}`);
	}
	const state = loadState(root);
	const target = resultPath(root, options.packetId);
	mkdirSync(path.dirname(target), { recursive: true });
	copyFileSync(options.resultPath, target);
	const result = JSON.parse(
		readFileSync(target, "utf8"),
	) as DispatchResultArtifact;
	state.dispatch.latestResultPath = repoRelative(root, target);
	state.dispatch.queuedSidecars = state.dispatch.queuedSidecars.filter(
		(id) => id !== options.packetId,
	);
	saveState(root, state);
	return { storedResultPath: state.dispatch.latestResultPath, result };
}

if (import.meta.main) {
	const root = repoRoot();
	if (process.argv.includes("--prepare")) {
		const roleIndex = process.argv.indexOf("--role");
		const role =
			roleIndex >= 0 && process.argv.length > roleIndex + 1
				? (process.argv[roleIndex + 1] as DispatchPacketArtifact["role"])
				: null;
		if (!role || !["planner", "worker", "sidecar"].includes(role)) {
			console.error(
				"Usage: bun run harness:dispatch --prepare --role <planner|worker|sidecar>",
			);
			process.exit(1);
		}
		const prepared = prepareDispatch({ root, role });
		console.log(`Prepared dispatch packet ${prepared.packet.packetId}.`);
		console.log(`  Packet: ${prepared.packetPath}`);
		process.exit(0);
	}

	if (process.argv.includes("--complete")) {
		const packetIndex = process.argv.indexOf("--complete");
		const resultIndex = process.argv.indexOf("--result");
		const packetId =
			packetIndex >= 0 && process.argv.length > packetIndex + 1
				? process.argv[packetIndex + 1]
				: null;
		const resultFile =
			resultIndex >= 0 && process.argv.length > resultIndex + 1
				? process.argv[resultIndex + 1]
				: null;
		if (!packetId || !resultFile) {
			console.error(
				"Usage: bun run harness:dispatch --complete <packet-id> --result <path>",
			);
			process.exit(1);
		}
		const completed = completeDispatch({
			root,
			packetId,
			resultPath: path.resolve(root, resultFile),
		});
		console.log(`Stored dispatch result for ${packetId}.`);
		console.log(`  Result: ${completed.storedResultPath}`);
		process.exit(0);
	}

	console.error(
		"Usage: bun run harness:dispatch --prepare --role <planner|worker|sidecar> | bun run harness:dispatch --complete <packet-id> --result <path>",
	);
	process.exit(1);
}
