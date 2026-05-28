import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createRepoWithTasks, makeTask } from "./orchestration-test-fixtures";
import { dispatchMilestones } from "./parallel-dispatch";
import { saveState } from "./planning";
import { readState } from "./test-support";

const tempRoots: string[] = [];

function initGit(root: string): void {
	execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
	execFileSync("git", ["config", "user.email", "tests@example.com"], {
		cwd: root,
		stdio: "ignore",
	});
	execFileSync("git", ["config", "user.name", "Harness Tests"], {
		cwd: root,
		stdio: "ignore",
	});
	execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "chore(test): seed repo"], {
		cwd: root,
		stdio: "ignore",
	});
}

describe("parallel dispatch", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("blocks milestones that do not resolve to affected areas", () => {
		const root = createRepoWithTasks([makeTask({ id: "T101" })], tempRoots);

		const result = dispatchMilestones({ root, apply: false, max: 2 });

		expect(result.blocked).toEqual([
			{
				milestoneId: "M1",
				reasons: ["affected areas are missing"],
			},
		]);
	});

	it("derives areas from tasks and blocks same-batch conflicts", () => {
		const root = createRepoWithTasks(
			[
				makeTask({
					id: "T101",
					milestoneId: "M1",
					affectedFilesOrAreas: ["apps/api"],
				}),
				makeTask({
					id: "T201",
					milestoneId: "M2",
					affectedFilesOrAreas: ["apps/api/src/runtime"],
				}),
			],
			tempRoots,
		);
		const state = readState(root);
		state.milestones.push({
			id: "M2",
			title: "Conflicting milestone",
			goal: "Test conflict detection",
			status: "planned",
			dependsOn: [],
			parallelEligible: true,
			affectedAreas: [],
			worktreeName: null,
			taskHints: [],
		});
		saveState(root, state);
		initGit(root);

		const result = dispatchMilestones({ root, apply: true, max: 2 });
		const updatedState = readState(root);

		expect(result.dispatched).toEqual(["M1"]);
		expect(result.blocked).toContainEqual({
			milestoneId: "M2",
			reasons: ["dispatch batch conflict with M1: apps/api"],
		});
		expect(updatedState.execution.activeMilestones).toEqual(["M1"]);
		expect(
			updatedState.milestones.find((milestone) => milestone.id === "M1")
				?.affectedAreas,
		).toEqual(["apps/api"]);
	});
});
