import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { buildCompactSnapshot, writeCompactSnapshot } from "./compact";
import { evaluateTask, orchestrateTask } from "./orchestration";
import { createRepo } from "./orchestration-test-fixtures";

const tempRoots: string[] = [];

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("compact snapshots", () => {
	it("summarizes the active task and recorded artifacts", () => {
		const root = createRepo(["bun --version"], tempRoots);
		orchestrateTask(root);

		const snapshot = buildCompactSnapshot(root);

		expect(snapshot.activeTask?.id).toBe("T101");
		expect(snapshot.artifacts.contract.path).toContain(".harness/contracts/");
		expect(snapshot.artifacts.handoff.summaryLines[0]).toContain("Task T101");
	});

	it("writes both json and markdown snapshot artifacts", () => {
		const root = createRepo(["bun --version"], tempRoots);
		orchestrateTask(root);
		evaluateTask("T101", root);

		const result = writeCompactSnapshot(root);
		const markdownPath = path.join(root, result.markdownPath);
		const jsonPath = path.join(root, result.jsonPath);

		expect(existsSync(markdownPath)).toBe(true);
		expect(existsSync(jsonPath)).toBe(true);
		expect(readFileSync(markdownPath, "utf8")).toContain(
			"# Harness Compact Snapshot",
		);
		expect(readFileSync(markdownPath, "utf8")).toContain("Status: passed");
	});
});
