import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { saveState } from "./planning";
import { repoRoot } from "./shared";
import {
	cloneRepo,
	commitAll,
	expectCommandSuccess,
	markMilestoneDone,
	readState,
	worktreePath,
} from "./test-support";

const root = repoRoot();
const describeCommandFlow =
	process.env.HARNESS_SKIP_COMMAND_FLOW === "1" ? describe.skip : describe;
setDefaultTimeout(90000);

describeCommandFlow("command flow — worktree", () => {
	it("dispatches and merges a completed milestone through a worktree", () => {
		const tempRoot = cloneRepo(root);
		expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:init",
			"--",
			"sample-project",
		]);
		expectCommandSuccess(tempRoot, ["bun", "run", "harness:plan"]);
		expectCommandSuccess(tempRoot, ["bun", "run", "check"]);
		const stateBeforeDispatch = readState(tempRoot);
		const milestone = stateBeforeDispatch.milestones.find(
			(entry) => entry.id === "M1",
		);
		expect(milestone).toBeTruthy();
		if (milestone) {
			milestone.affectedAreas = ["apps/api"];
		}
		saveState(tempRoot, stateBeforeDispatch);
		commitAll(tempRoot, "chore(template): initialize sample project");

		expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:parallel-dispatch",
			"--",
			"--apply",
		]);
		commitAll(tempRoot, "harness(dispatch): record active worktrees");
		const dispatchedState = readState(tempRoot);
		const activeWorktree = dispatchedState.execution.activeWorktrees.find(
			(entry) => entry.milestoneId === "M1",
		);
		expect(activeWorktree).toBeTruthy();

		const milestoneRoot = worktreePath(
			tempRoot,
			activeWorktree?.worktree ?? "",
		);
		markMilestoneDone(milestoneRoot, "M1");
		expectCommandSuccess(milestoneRoot, ["bun", "run", "format"]);
		expectCommandSuccess(milestoneRoot, ["bun", "run", "check"]);
		commitAll(milestoneRoot, "harness(m1): complete milestone");

		expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:merge-milestone",
			"--",
			"M1",
		]);
		const mergedState = readState(tempRoot);
		expect(
			mergedState.milestones.find((milestone) => milestone.id === "M1")?.status,
		).toBe("complete");
		expect(
			mergedState.execution.activeWorktrees.some(
				(entry) => entry.milestoneId === "M1",
			),
		).toBe(false);
		expect(
			existsSync(path.join(tempRoot, ".harness/merges/m1-latest.json")),
		).toBe(true);
	});
});
