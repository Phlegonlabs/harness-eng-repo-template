import { readFileSync } from "node:fs";
import path from "node:path";
import { readJson } from "./shared";
import type {
	DispatchPacketArtifact,
	DispatchResultArtifact,
	GuardianRunRecord,
	HarnessCompactArtifactSummary,
	HarnessState,
	TaskEvaluationArtifact,
	TaskHandoffArtifact,
	TaskRecord,
} from "./types";

export function summarizeContract(
	root: string,
	relativePath: string | null,
): HarnessCompactArtifactSummary {
	if (!relativePath) {
		return { path: null, summaryLines: ["No contract artifact recorded."] };
	}
	const content = readFileSync(path.join(root, relativePath), "utf8").split(
		/\r?\n/,
	);
	const heading = content.find((line) => line.startsWith("# Task Contract:"));
	const goalIndex = content.indexOf("## Goal");
	const deliverablesIndex = content.indexOf("## Deliverables");
	const checksIndex = content.indexOf("## Validation Checks");
	const goal =
		goalIndex >= 0
			? (content.slice(goalIndex + 1).find((line) => line.trim().length > 0) ??
				"Goal not found.")
			: "Goal not found.";
	const deliverables =
		deliverablesIndex >= 0
			? content
					.slice(
						deliverablesIndex + 1,
						checksIndex >= 0 ? checksIndex : undefined,
					)
					.filter((line) => line.startsWith("- "))
					.slice(0, 3)
					.map((line) => line.slice(2))
			: [];
	const checks =
		checksIndex >= 0
			? content
					.slice(checksIndex + 1)
					.filter((line) => line.startsWith("- "))
					.slice(0, 3)
					.map((line) => line.slice(2))
			: [];
	return {
		path: relativePath,
		summaryLines: [
			heading?.replace(/^#\s+/, "") ?? "Task contract",
			`Goal: ${goal}`,
			`Deliverables: ${
				deliverables.length > 0 ? deliverables.join("; ") : "none listed"
			}`,
			`Checks: ${checks.length > 0 ? checks.join("; ") : "none"}`,
		],
	};
}

export function summarizeEvaluation(
	root: string,
	relativePath: string | null,
): HarnessCompactArtifactSummary {
	if (!relativePath) {
		return { path: null, summaryLines: ["No evaluation artifact recorded."] };
	}
	const artifact = readJson<TaskEvaluationArtifact>(
		path.join(root, relativePath),
	);
	const findings =
		artifact.findings.length > 0
			? artifact.findings
					.slice(0, 3)
					.map((finding) => `${finding.severity}: ${finding.message}`)
			: ["No findings recorded."];
	return {
		path: relativePath,
		summaryLines: [
			`Status: ${artifact.status}`,
			`Iteration: ${artifact.iteration}`,
			`Recovered after retry: ${
				artifact.gateResults.some((result) => result.recovered) ? "yes" : "no"
			}`,
			`Attempts: ${artifact.gateResults.reduce(
				(total, result) => total + result.attemptCount,
				0,
			)}`,
			...findings,
		],
	};
}

export function summarizeHandoff(
	root: string,
	relativePath: string | null,
): HarnessCompactArtifactSummary {
	if (!relativePath) {
		return { path: null, summaryLines: ["No handoff artifact recorded."] };
	}
	const artifact = readJson<TaskHandoffArtifact>(path.join(root, relativePath));
	return {
		path: relativePath,
		summaryLines: [
			artifact.summary,
			`Next: ${artifact.nextAction}`,
			`Risks: ${
				artifact.risks.length > 0
					? artifact.risks.slice(0, 3).join("; ")
					: "none"
			}`,
		],
	};
}

export function summarizeDispatchPacket(
	root: string,
	relativePath: string | null,
): HarnessCompactArtifactSummary {
	if (!relativePath) {
		return { path: null, summaryLines: ["No dispatch packet recorded."] };
	}
	const artifact = readJson<DispatchPacketArtifact>(
		path.join(root, relativePath),
	);
	return {
		path: relativePath,
		summaryLines: [
			`Packet: ${artifact.packetId}`,
			`Role: ${artifact.role}`,
			`Goal: ${artifact.goal}`,
			`Scope: ${artifact.scope}`,
		],
	};
}

export function summarizeDispatchResult(
	root: string,
	relativePath: string | null,
): HarnessCompactArtifactSummary {
	if (!relativePath) {
		return { path: null, summaryLines: ["No dispatch result recorded."] };
	}
	const artifact = readJson<DispatchResultArtifact>(
		path.join(root, relativePath),
	);
	return {
		path: relativePath,
		summaryLines: [
			artifact.summary,
			`Next: ${artifact.recommendedNextAction}`,
			`Sources: ${
				artifact.sources.length > 0
					? artifact.sources
							.slice(0, 3)
							.map((source) => `${source.file}:${source.line}`)
							.join("; ")
					: "none"
			}`,
		],
	};
}

export function latestTask(tasks: TaskRecord[]): TaskRecord | null {
	return (
		[...tasks]
			.filter(
				(task) =>
					task.lastCheckpointAt ||
					task.artifacts.latestHandoffPath ||
					task.artifacts.latestEvaluationPath,
			)
			.sort((left, right) =>
				(right.lastCheckpointAt ?? "").localeCompare(
					left.lastCheckpointAt ?? "",
				),
			)[0] ?? null
	);
}

export function latestGuardianRecord(
	state: HarnessState,
): GuardianRunRecord | null {
	return (
		[state.guardians.preflight, state.guardians.stop, state.guardians.drift]
			.filter((record) => record.runAt)
			.sort((left, right) =>
				(right.runAt ?? "").localeCompare(left.runAt ?? ""),
			)[0] ?? null
	);
}
