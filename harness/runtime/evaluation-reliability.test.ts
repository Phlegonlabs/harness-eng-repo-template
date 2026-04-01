import { afterEach, describe, expect, it } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { evaluateTask, orchestrateTask } from "./orchestration";
import { createRepo } from "./orchestration-test-fixtures";
import { loadState } from "./planning";
import { readJson } from "./shared";
import type { TaskEvaluationArtifact } from "./types";

const tempRoots: string[] = [];

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("evaluation reliability", () => {
	it("records retry metadata when evaluator exhausts retry budget", () => {
		const root = createRepo(
			[`node -e "const start=Date.now(); while(Date.now()-start<500){}"`],
			tempRoots,
		);
		const configPath = path.join(root, "harness/config.json");
		const config = readJson<{ evaluation: { commandTimeoutMs: number } }>(
			configPath,
		);
		config.evaluation.commandTimeoutMs = 50;
		writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

		orchestrateTask(root);
		evaluateTask("T101", root);
		const state = loadState(root);
		const artifact = readJson<TaskEvaluationArtifact>(
			path.join(root, state.tasks[0].artifacts.latestEvaluationPath ?? ""),
		);

		expect(artifact.status).toBe("failed");
		expect(artifact.gateResults[0]?.attemptCount).toBeGreaterThan(1);
		expect(artifact.gateResults[0]?.recovered).toBe(false);
		expect(artifact.gateResults[0]?.timedOut).toBe(true);
		expect(artifact.gateResults[0]?.attempts[0]?.status).toBe("timed_out");
		expect(
			artifact.gateResults[0]?.attempts.every(
				(attempt) => attempt.status === "timed_out",
			),
		).toBe(true);
		expect(artifact.findings[0]?.message).toContain("attempt");
	});
});
