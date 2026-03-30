import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { repoRoot } from "./shared";
import {
	cloneRepo,
	commitAll,
	markMilestoneDone,
	readState,
	runCommand,
	worktreePath,
} from "./test-support";

const root = repoRoot();
const describeCommandFlow =
	process.env.HARNESS_SKIP_COMMAND_FLOW === "1" ? describe.skip : describe;
setDefaultTimeout(90000);

describeCommandFlow("command flow — worktree", () => {
	it("dispatches and merges a completed milestone through a worktree", () => {
		const tempRoot = cloneRepo(root);
		expect(
			runCommand(tempRoot, [
				"bun",
				"run",
				"harness:init",
				"--",
				"sample-project",
			]).code,
		).toBe(0);
		expect(runCommand(tempRoot, ["bun", "run", "harness:plan"]).code).toBe(0);
		expect(runCommand(tempRoot, ["bun", "run", "check"]).code).toBe(0);
		commitAll(tempRoot, "chore(template): initialize sample project");

		expect(
			runCommand(tempRoot, [
				"bun",
				"run",
				"harness:parallel-dispatch",
				"--",
				"--apply",
			]).code,
		).toBe(0);
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
		expect(runCommand(milestoneRoot, ["bun", "run", "format"]).code).toBe(0);
		expect(runCommand(milestoneRoot, ["bun", "run", "check"]).code).toBe(0);
		commitAll(milestoneRoot, "harness(m1): complete milestone");

		expect(
			runCommand(tempRoot, [
				"bun",
				"run",
				"harness:merge-milestone",
				"--",
				"M1",
			]).code,
		).toBe(0);
		const mergedState = readState(tempRoot);
		expect(
			mergedState.milestones.find((milestone) => milestone.id === "M1")?.status,
		).toBe("complete");
		expect(
			mergedState.execution.activeWorktrees.some(
				(entry) => entry.milestoneId === "M1",
			),
		).toBe(false);
	});
});
