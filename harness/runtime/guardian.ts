import path from "node:path";
import { runCommandWithCapture } from "./command-runner";
import { runEntropyScans } from "./entropy-all";
import { updateEntropyDelta } from "./entropy-monitor";
import { runLintSuite } from "./lint-all";
import { captureConsole, hasAdvisoryOrFailureSignal } from "./output-control";
import { loadState, saveState } from "./planning";
import { summarizeLines, writeRuntimeLog } from "./runtime-logs";
import { readJson, repoRelative, repoRoot, writeJson } from "./shared";
import type { GuardianMode, GuardianRunRecord, HarnessConfig } from "./types";
import { validationContext } from "./validation";
import { runValidationEntry } from "./validation-entry";
import { fastValidationSteps } from "./validation-steps";

function config(root: string): HarnessConfig {
	return readJson<HarnessConfig>(path.join(root, "harness/config.json"));
}

function guardianArtifactPath(root: string, mode: GuardianMode): string {
	return path.join(root, ".harness", "guardians", `${mode}-latest.json`);
}

function currentTaskId(root: string): string | null {
	const state = loadState(root);
	return (
		state.tasks.find((task) =>
			["in_progress", "evaluation_pending"].includes(task.status),
		)?.id ?? null
	);
}

export function runGuardian(options?: {
	root?: string;
	mode: GuardianMode;
	sourceEvent?: string;
	persistState?: boolean;
}): {
	code: number;
	lines: string[];
	record: GuardianRunRecord;
} {
	const root = options?.root ?? repoRoot();
	const mode = options?.mode ?? "preflight";
	const sourceEvent = options?.sourceEvent ?? `manual:${mode}`;
	const persistState = options?.persistState ?? true;
	const cfg = config(root);
	const enabled =
		cfg.guardians.enabled &&
		(mode === "preflight"
			? cfg.guardians.preflight
			: mode === "stop"
				? cfg.guardians.stop
				: cfg.guardians.drift);

	let lines: string[] = [];
	let code = 0;

	if (!enabled) {
		lines = [`Guardian ${mode} disabled in harness/config.json.`];
	} else if (mode === "preflight") {
		const biome = runCommandWithCapture({
			root,
			commandLine: "bunx biome check --error-on-warnings .",
			logCategory: "guardian-preflight-biome",
			maxSnippetLines: 10,
		});
		if (biome.exitCode !== 0) {
			lines.push(...biome.snippet);
			if (biome.logPath) {
				lines.push(`INFO: Full output logged at ${biome.logPath}`);
			}
			code = 1;
		}
		const lintCapture = captureConsole(() =>
			runLintSuite(validationContext(root)),
		);
		if (lintCapture.result !== 0) {
			const logPath = writeRuntimeLog({
				root,
				category: "guardian-preflight-lint",
				lines: lintCapture.lines,
			});
			const { snippet, truncated } = summarizeLines(lintCapture.lines, 10);
			lines.push(...snippet);
			if (logPath && truncated) {
				lines.push(`INFO: Full output logged at ${logPath}`);
			}
			code = 1;
		}
		if (lines.length === 0) {
			lines.push("PASS: Guardian preflight checks passed.");
		}
	} else if (mode === "stop") {
		const captured = captureConsole(() =>
			runValidationEntry({
				root,
				title: "guardian stop",
				subtitle: "Quiet-success handoff validation",
				steps: fastValidationSteps(root),
				quietSuccess: true,
			}),
		);
		lines = captured.lines;
		code = captured.result;
		if (lines.length === 0) {
			lines.push("PASS: Guardian stop checks passed.");
		}
	} else {
		const captured = captureConsole(() =>
			runEntropyScans(validationContext(root)),
		);
		lines = captured.lines;
		const delta = updateEntropyDelta({
			root,
			taskId: currentTaskId(root),
			sourceEvent,
		});
		if (delta?.exceeded) {
			lines.push(
				`WARN: Entropy drift ${delta.percent}% exceeds threshold ${cfg.entropy.driftThresholdPercent}%.`,
			);
		}
		code = 0;
		if (lines.length === 0) {
			lines.push("PASS: Guardian drift checks passed.");
		}
	}

	const status =
		code !== 0
			? "failed"
			: hasAdvisoryOrFailureSignal(lines)
				? "warn"
				: "passed";
	const logPath =
		cfg.guardians.logFailures && status !== "passed"
			? writeRuntimeLog({
					root,
					category: `guardian-${mode}`,
					lines,
				})
			: null;
	const artifactPath = guardianArtifactPath(root, mode);
	writeJson(artifactPath, {
		version: "1.0.0",
		mode,
		sourceEvent,
		runAt: new Date().toISOString(),
		code,
		lines,
		logPath,
	});
	const record: GuardianRunRecord = {
		status,
		runAt: new Date().toISOString(),
		logPath,
		artifactPath: repoRelative(root, artifactPath),
		sourceEvent,
		summary: summarizeLines(lines, 4).snippet,
	};
	if (persistState) {
		const state = loadState(root);
		state.guardians[mode] = record;
		saveState(root, state);
	}

	return { code, lines, record };
}

if (import.meta.main) {
	const modeArgIndex = process.argv.indexOf("--mode");
	const mode =
		modeArgIndex >= 0 && process.argv.length > modeArgIndex + 1
			? (process.argv[modeArgIndex + 1] as GuardianMode)
			: null;
	const persistState = !process.argv.includes("--no-state");
	const quietSuccess = process.argv.includes("--quiet-success");
	if (!mode || !["preflight", "stop", "drift"].includes(mode)) {
		console.error(
			"Usage: bun run harness:guardian --mode <preflight|stop|drift> [--quiet-success] [--no-state]",
		);
		process.exit(1);
	}
	const result = runGuardian({ root: repoRoot(), mode, persistState });
	if (quietSuccess && result.record.status === "passed") {
		process.exit(result.code);
	}
	for (const line of result.lines) {
		console.log(line);
	}
	process.exit(result.code);
}
