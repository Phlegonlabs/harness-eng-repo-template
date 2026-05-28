import { afterEach, describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { orchestrateTask } from "./orchestration";
import {
	createRepo,
	createRepoWithTasks,
	makeTask,
} from "./orchestration-test-fixtures";
import { saveState } from "./planning";
import { buildHarnessStatus } from "./status";
import { readState } from "./test-support";

const tempRoots: string[] = [];

describe("harness status", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { recursive: true, force: true });
		}
	});
	it("reports the active task and suggested skills", () => {
		const root = createRepo(["bun --version"], tempRoots);
		orchestrateTask(root);

		const status = buildHarnessStatus(root);

		expect(status.activeTask?.id).toBe("T101");
		expect(status.activeTask?.status).toBe("in_progress");
		expect(status.suggestedSkills).toContain("skills/implementation/SKILL.md");
		expect(status.progress.inProgress).toBe(1);
		expect(status.resume.activeTaskCheckpointAt).not.toBeNull();
		expect(status.resume.latestStateSnapshot?.path).toContain(
			".harness/snapshots/",
		);
		expect(status.activeTask?.contractPath).toBeTruthy();
		expect(status.resume.recommendedArtifactPaths).toContain(
			status.activeTask?.contractPath ?? "",
		);
		expect(status.resume.recommendedRecoveryPoint.kind).toBe("handoff");
		expect(status.activeTask?.latestHandoffPath).toBeTruthy();
		expect(status.resume.recommendedRecoveryPoint.path).toBe(
			status.activeTask?.latestHandoffPath ?? null,
		);
		expect(status.resume.recommendedStateSnapshot?.path).toContain(
			".harness/snapshots/",
		);
	});

	it("surfaces blocked tasks when no active task can proceed", () => {
		const root = createRepoWithTasks(
			[
				makeTask({
					id: "T101",
					status: "blocked",
					stallCount: 2,
					iteration: 3,
				}),
				makeTask({ id: "T102", dependsOn: ["T101"] }),
			],
			tempRoots,
		);

		const status = buildHarnessStatus(root);

		expect(status.activeTask).toBeNull();
		expect(status.blockedTasks).toHaveLength(1);
		expect(status.nextAction).toContain("harness:unblock");
	});

	it("recommends planning when the repo is ready but has no tasks yet", () => {
		const root = createRepoWithTasks([], tempRoots);

		const status = buildHarnessStatus(root);

		expect(status.phase).toBe("PLANNING");
		expect(status.activeTask).toBeNull();
		expect(status.nextAction).toContain("harness:plan");
	});

	it("aggregates recent validation evidence instead of returning unknown", () => {
		const root = createRepo(["bun --version"], tempRoots);
		const statusBefore = buildHarnessStatus(root);

		expect(statusBefore.validationStatus).toBe("unknown");

		const state = readState(root);
		state.validation.recentRuns = [
			{
				source: "validate",
				status: "passed",
				runAt: "2026-05-28T10:00:00.000Z",
				artifactPath: ".harness/validations/validate-latest.json",
				summary: ["PASS"],
			},
			{
				source: "evaluate",
				status: "failed",
				runAt: "2026-05-28T11:00:00.000Z",
				artifactPath: ".harness/evaluations/T101/latest.json",
				summary: ["FAIL"],
			},
		];
		saveState(root, state);

		const statusAfter = buildHarnessStatus(root);

		expect(statusAfter.validationStatus).toBe("failed");
	});
});
