import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { evaluateTask, orchestrateTask, unblockTask } from "./orchestration";
import {
	createRepo,
	createRepoWithTasks,
	makeTask,
} from "./orchestration-test-fixtures";
import { loadState, milestonesFromProductDoc } from "./planning";

const tempRoots: string[] = [];

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("orchestration lifecycle", () => {
	it("prepares pending tasks with a contract and handoff artifact", () => {
		const root = createRepo(["bun --version"], tempRoots);
		const result = orchestrateTask(root);
		const state = loadState(root);
		const task = state.tasks[0];
		const milestone = state.milestones[0];

		expect(result?.task.id).toBe("T101");
		expect(task.status).toBe("in_progress");
		expect(task.iteration).toBe(1);
		expect(task.contractStatus).toBe("approved");
		expect(task.artifacts.contractPath).toBeTruthy();
		expect(task.artifacts.latestHandoffPath).toBeTruthy();
		expect(existsSync(path.join(root, task.artifacts.contractPath ?? ""))).toBe(
			true,
		);
		expect(
			existsSync(path.join(root, task.artifacts.latestHandoffPath ?? "")),
		).toBe(true);
		expect(milestone.status).toBe("active");
	});

	it("marks tasks done and completes the milestone", () => {
		const root = createRepo(["bun --version"], tempRoots);
		orchestrateTask(root);
		const result = evaluateTask("T101", root);
		const state = loadState(root);

		expect(result?.task.id).toBe("T101");
		expect(state.tasks[0].status).toBe("done");
		expect(state.tasks[0].evaluatorStatus).toBe("passed");
		expect(state.tasks[0].artifacts.latestEvaluationPath).toBeTruthy();
		expect(state.milestones[0].status).toBe("complete");
	});

	it("blocks tasks after repeated evaluator failures", () => {
		const root = createRepo(['node -e "process.exit(1)"'], tempRoots);
		orchestrateTask(root);
		const first = evaluateTask("T101", root);
		const second = evaluateTask("T101", root);
		const state = loadState(root);

		expect(first?.task.evaluatorStatus).toBe("failed");
		expect(second?.task.evaluatorStatus).toBe("failed");
		expect(state.tasks[0].status).toBe("blocked");
		expect(state.tasks[0].stallCount).toBe(2);
	});

	it("respects task dependency order", () => {
		const root = createRepoWithTasks(
			[
				makeTask({
					id: "T101",
					status: "done",
					iteration: 1,
					contractStatus: "approved",
					evaluatorStatus: "passed",
				}),
				makeTask({ id: "T102", dependsOn: ["T101"] }),
				makeTask({ id: "T103", dependsOn: ["T102"] }),
			],
			tempRoots,
		);
		expect(orchestrateTask(root)?.task.id).toBe("T102");
	});

	it("skips tasks with unmet dependencies", () => {
		const root = createRepoWithTasks(
			[
				makeTask({ id: "T101", status: "blocked" }),
				makeTask({ id: "T102", dependsOn: ["T101"] }),
			],
			tempRoots,
		);
		expect(orchestrateTask(root)).toBeNull();
	});

	it("parses milestones when section is last in document", () => {
		const tmpDir = mkdtempSync(path.join(os.tmpdir(), "harness-planning-"));
		tempRoots.push(tmpDir);
		const tmpFile = path.join(tmpDir, "product.md");
		writeFileSync(
			tmpFile,
			[
				"# Product",
				"",
				"## Overview",
				"Some content.",
				"",
				"## Proposed Milestones",
				"- Milestone One",
				"  - task hint A",
				"  - task hint B",
				"- Milestone Two",
			].join("\n"),
		);
		const milestones = milestonesFromProductDoc(tmpFile);
		expect(milestones).toHaveLength(2);
		expect(milestones[0].title).toBe("Milestone One");
		expect(milestones[0].taskHints).toEqual(["task hint A", "task hint B"]);
		expect(milestones[1].title).toBe("Milestone Two");
	});

	it("does not complete milestone until all tasks are done", () => {
		const root = createRepoWithTasks(
			[makeTask({ id: "T101" }), makeTask({ id: "T102", dependsOn: ["T101"] })],
			tempRoots,
		);
		orchestrateTask(root);
		evaluateTask("T101", root);
		expect(loadState(root).milestones[0].status).toBe("active");

		orchestrateTask(root);
		evaluateTask("T102", root);
		expect(loadState(root).milestones[0].status).toBe("complete");
	});

	it("unblocks a blocked task", () => {
		const root = createRepo(['node -e "process.exit(1)"'], tempRoots);
		orchestrateTask(root);
		evaluateTask("T101", root);
		evaluateTask("T101", root);
		expect(loadState(root).tasks[0].status).toBe("blocked");

		const result = unblockTask("T101", root);
		expect(result?.status).toBe("in_progress");
		expect(result?.stallCount).toBe(0);
		expect(loadState(root).tasks[0].status).toBe("in_progress");
	});

	it("returns null when unblocking a non-blocked task", () => {
		const root = createRepo(["bun --version"], tempRoots);
		orchestrateTask(root);
		expect(unblockTask("T101", root)).toBeNull();
	});

	it("loads debugging skill when a task title indicates a bug fix", () => {
		const root = createRepoWithTasks(
			[
				makeTask({
					id: "T101",
					kind: "implementation",
					title: "Fix API regression in health endpoint",
				}),
			],
			tempRoots,
		);

		const result = orchestrateTask(root);

		expect(result?.skills).toContain("skills/debugging/SKILL.md");
	});
});
