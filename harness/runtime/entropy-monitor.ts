import { readFileSync } from "node:fs";
import path from "node:path";
import { loadState, saveState } from "./planning";
import { readJson, trackedFiles } from "./shared";
import type {
	EntropyBaselineRecord,
	EntropyDeltaRecord,
	EntropySnapshot,
	HarnessConfig,
} from "./types";

const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx|css|scss|html|md)$/i;
const pendingMarkerPattern = new RegExp(
	"\\b(?:" + "TO" + "DO|FIX" + "ME)\\b",
	"g",
);

export function captureEntropySnapshot(root: string): EntropySnapshot {
	const files = trackedFiles(root);
	let totalLines = 0;
	let pendingMarkerCount = 0;
	for (const relativePath of files) {
		const absolutePath = path.join(root, relativePath);
		try {
			const content = readFileSync(absolutePath, "utf8");
			totalLines += content.split(/\r?\n/).length;
			pendingMarkerCount += (content.match(pendingMarkerPattern) ?? []).length;
		} catch {
			// Ignore binary or unreadable files.
		}
	}
	return {
		trackedFiles: files.length,
		markdownFiles: files.filter((file) => file.endsWith(".md")).length,
		sourceFiles: files.filter((file) => SOURCE_FILE_PATTERN.test(file)).length,
		totalLines,
		pendingMarkerCount,
	};
}

function entropyMagnitude(snapshot: EntropySnapshot): number {
	return (
		snapshot.trackedFiles +
		snapshot.markdownFiles +
		snapshot.sourceFiles +
		snapshot.totalLines +
		snapshot.pendingMarkerCount
	);
}

function config(root: string): HarnessConfig {
	return readJson<HarnessConfig>(path.join(root, "harness/config.json"));
}

export function ensureEntropyBaseline(root: string, taskId: string): void {
	const state = loadState(root);
	if (state.entropy.baselines[taskId]) {
		return;
	}
	const snapshot = captureEntropySnapshot(root);
	state.entropy.baselines[taskId] = {
		taskId,
		capturedAt: new Date().toISOString(),
		snapshot,
	};
	saveState(root, state);
}

export function computeEntropyDelta(options: {
	root: string;
	taskId?: string | null;
	sourceEvent: string;
}): EntropyDeltaRecord | null {
	const { root, taskId, sourceEvent } = options;
	const cfg = config(root);
	if (!cfg.entropy.enabled) {
		return null;
	}
	const state = loadState(root);
	const baselineRecord: EntropyBaselineRecord | undefined =
		taskId !== undefined && taskId !== null
			? state.entropy.baselines[taskId]
			: undefined;
	const current = captureEntropySnapshot(root);
	const baseline = baselineRecord?.snapshot ?? null;
	const currentMagnitude = entropyMagnitude(current);
	const baselineMagnitude = baseline
		? entropyMagnitude(baseline)
		: currentMagnitude;
	const percent =
		baselineMagnitude === 0
			? 0
			: Number(
					(
						(Math.abs(currentMagnitude - baselineMagnitude) /
							baselineMagnitude) *
						100
					).toFixed(2),
				);
	return {
		taskId: taskId ?? null,
		checkedAt: new Date().toISOString(),
		sourceEvent,
		percent,
		exceeded: percent > cfg.entropy.driftThresholdPercent,
		baseline,
		current,
	};
}

export function updateEntropyDelta(options: {
	root: string;
	taskId?: string | null;
	sourceEvent: string;
}): EntropyDeltaRecord | null {
	const delta = computeEntropyDelta(options);
	if (!delta) {
		return null;
	}
	const state = loadState(options.root);
	state.entropy.latestDelta = delta;
	saveState(options.root, state);
	return delta;
}
