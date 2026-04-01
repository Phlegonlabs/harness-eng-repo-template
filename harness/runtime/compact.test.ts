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
		expect(snapshot.resume.latestStateSnapshot?.path).toContain(
			".harness/snapshots/",
		);
		expect(snapshot.resume.recommendedRecoveryPoint.kind).toBe("handoff");
		expect(snapshot.resume.recommendedStateSnapshot?.path).toContain(
			".harness/snapshots/",
		);
		expect(snapshot.artifacts.contract.path).toBeTruthy();
		expect(snapshot.resume.recommendedArtifactPaths).toContain(
			snapshot.artifacts.contract.path ?? "",
		);
		expect(snapshot.resume.instructions.length).toBeGreaterThan(0);
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
		expect(readFileSync(markdownPath, "utf8")).toContain("## Resume");
		expect(
			result.snapshot.resume.recentArtifacts.some(
				(entry) => entry.kind === "evaluation",
			),
		).toBe(true);
		expect(
			result.snapshot.resume.recentArtifacts.some(
				(entry) => entry.kind === "handoff",
			),
		).toBe(true);
		expect(readFileSync(markdownPath, "utf8")).toContain("Recent task history");
	});
});
