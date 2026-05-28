import { hasAdvisoryOrFailureSignal } from "./output-control";
import type {
	GuardianRunRecord,
	HarnessState,
	ValidationRunRecord,
	ValidationStatus,
} from "./types";

const MAX_VALIDATION_RUNS = 12;

function guardianRunToValidationRun(
	source: ValidationRunRecord["source"],
	record: GuardianRunRecord,
): ValidationRunRecord | null {
	if (!record.runAt || record.status === "idle") {
		return null;
	}
	return {
		source,
		status: record.status === "passed" ? "passed" : record.status,
		runAt: record.runAt,
		artifactPath: record.artifactPath,
		summary: record.summary,
	};
}

function uniqueRecentRuns(runs: ValidationRunRecord[]): ValidationRunRecord[] {
	const seen = new Set<string>();
	const unique: ValidationRunRecord[] = [];
	for (const run of runs.sort((left, right) =>
		right.runAt.localeCompare(left.runAt),
	)) {
		const key = `${run.source}:${run.runAt}:${run.status}:${run.artifactPath ?? "-"}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		unique.push(run);
	}
	return unique.slice(0, MAX_VALIDATION_RUNS);
}

export function statusFromCommandResult(
	code: number,
	lines: string[],
): Exclude<ValidationStatus, "unknown"> {
	if (code !== 0) {
		return "failed";
	}
	return hasAdvisoryOrFailureSignal(lines) ? "warn" : "passed";
}

export function appendValidationRun(
	state: HarnessState,
	run: ValidationRunRecord,
): void {
	state.validation.recentRuns = uniqueRecentRuns([
		run,
		...(state.validation.recentRuns ?? []),
	]);
}

export function aggregateValidationStatus(
	state: HarnessState,
): ValidationStatus {
	const recentRuns = uniqueRecentRuns([
		...(state.validation?.recentRuns ?? []),
		...[
			guardianRunToValidationRun(
				"guardian_preflight",
				state.guardians.preflight,
			),
			guardianRunToValidationRun("guardian_stop", state.guardians.stop),
			guardianRunToValidationRun("guardian_drift", state.guardians.drift),
		].filter((entry): entry is ValidationRunRecord => entry !== null),
	]);
	if (recentRuns.length === 0) {
		return "unknown";
	}
	const latestBySource = new Map<
		ValidationRunRecord["source"],
		ValidationRunRecord
	>();
	for (const run of recentRuns) {
		if (!latestBySource.has(run.source)) {
			latestBySource.set(run.source, run);
		}
	}
	const statuses = [...latestBySource.values()].map((run) => run.status);
	if (statuses.includes("failed")) {
		return "failed";
	}
	if (statuses.includes("warn")) {
		return "warn";
	}
	return "passed";
}
