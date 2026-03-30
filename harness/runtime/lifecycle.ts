import path from "node:path";
import { writeCompactSnapshot } from "./compact";
import { ensureEntropyBaseline, updateEntropyDelta } from "./entropy-monitor";
import { loadState } from "./planning";
import { readJson, repoRoot } from "./shared";
import type { HarnessConfig } from "./types";

function config(root: string): HarnessConfig {
	return readJson<HarnessConfig>(path.join(root, "harness/config.json"));
}

export function ensureTaskBaseline(
	root: string = repoRoot(),
	taskId: string | null | undefined,
): void {
	if (!taskId) return;
	const cfg = config(root);
	if (!cfg.entropy.enabled || !cfg.entropy.baselineOnTaskStart) {
		return;
	}
	ensureEntropyBaseline(root, taskId);
}

export function refreshLifecycleArtifacts(options?: {
	root?: string;
	sourceEvent: string;
	taskId?: string | null;
}): void {
	const root = options?.root ?? repoRoot();
	const state = loadState(root);
	const cfg = config(root);
	if (cfg.entropy.enabled) {
		updateEntropyDelta({
			root,
			taskId:
				options?.taskId ??
				state.tasks.find((task) =>
					["in_progress", "evaluation_pending"].includes(task.status),
				)?.id,
			sourceEvent: options?.sourceEvent ?? "manual",
		});
	}
	if (cfg.contextManagement.enabled && cfg.contextManagement.autoCompact) {
		writeCompactSnapshot({
			root,
			sourceEvent: options?.sourceEvent ?? "manual",
		});
	}
}
