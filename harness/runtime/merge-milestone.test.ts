import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { mergeMilestone } from "./merge-milestone";
import { createRepoWithTasks, makeTask } from "./orchestration-test-fixtures";
import { dispatchMilestones } from "./parallel-dispatch";
import { readState } from "./test-support";

const tempRoots: string[] = [];

function git(root: string, args: string[]): string {
	return execFileSync("git", args, {
		cwd: root,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

function initGit(root: string): void {
	git(root, ["init"]);
	git(root, ["config", "user.email", "tests@example.com"]);
	git(root, ["config", "user.name", "Harness Tests"]);
	git(root, ["add", "."]);
	git(root, ["commit", "-m", "chore(test): seed repo"]);
}

function commitAll(root: string, message: string): void {
	git(root, ["add", "."]);
	git(root, ["commit", "-m", message]);
}

function writeHarnessPackage(root: string): void {
	mkdirSync(path.join(root, "docs"), { recursive: true });
	writeFileSync(
		path.join(root, ".gitignore"),
		".worktrees/\n.harness/merges/\n.harness/snapshots/\n.harness/validations/\n",
	);
	writeFileSync(path.join(root, "docs/progress.md"), "# Progress\n");
	writeFileSync(
		path.join(root, "package.json"),
		`${JSON.stringify(
			{
				name: "merge-test",
				private: true,
				scripts: {
					"harness:guardian":
						"node -e \"const fs=require('node:fs'); process.exit(fs.existsSync('.fail-guardian') ? 1 : 0)\" --",
					"harness:validate":
						"node -e \"const fs=require('node:fs'); process.exit(fs.existsSync('.fail-validate') ? 1 : 0)\" --",
				},
			},
			null,
			2,
		)}\n`,
	);
}

function prepareActiveMilestoneWorktree(): {
	root: string;
	worktreeRoot: string;
} {
	const root = createRepoWithTasks(
		[
			makeTask({
				id: "T101",
				status: "done",
				contractStatus: "approved",
				evaluatorStatus: "passed",
				iteration: 1,
				affectedFilesOrAreas: ["apps/api"],
			}),
		],
		tempRoots,
	);
	writeHarnessPackage(root);
	initGit(root);
	const dispatchResult = dispatchMilestones({ root, apply: true, max: 1 });
	expect(dispatchResult.dispatched).toEqual(["M1"]);
	commitAll(root, "harness(dispatch): activate milestone");
	const worktreeRoot = path.join(
		root,
		readState(root).execution.activeWorktrees[0]?.worktree ?? "",
	);
	git(worktreeRoot, ["reset", "--hard", "HEAD"]);
	return { root, worktreeRoot };
}

describe("merge milestone", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("blocks merges when the milestone branch has no unique commits", () => {
		const { root } = prepareActiveMilestoneWorktree();

		const result = mergeMilestone("M1", root);

		expect(result.status).toBe("blocked");
		expect(result.message).toContain("has no commits to merge");
		expect(result.auditPath).toBeTruthy();
	});

	it("blocks merges when the worktree is dirty", () => {
		const { root, worktreeRoot } = prepareActiveMilestoneWorktree();
		writeFileSync(
			path.join(worktreeRoot, "notes.txt"),
			"unique branch change\n",
		);
		commitAll(worktreeRoot, "feat(m1): add branch-only note");
		writeFileSync(path.join(worktreeRoot, "notes.txt"), "dirty worktree\n");

		const result = mergeMilestone("M1", root);

		expect(result.status).toBe("blocked");
		expect(result.message).toContain("worktree is not clean");
	});

	it("merges a validated milestone branch and writes a merge audit artifact", () => {
		const { root, worktreeRoot } = prepareActiveMilestoneWorktree();
		writeFileSync(
			path.join(worktreeRoot, "notes.txt"),
			"unique branch change\n",
		);
		commitAll(worktreeRoot, "feat(m1): add branch-only note");

		const result = mergeMilestone("M1", root);
		const state = readState(root);

		expect(result.status).toBe("merged");
		expect(result.auditPath).toBeTruthy();
		expect(
			state.milestones.find((milestone) => milestone.id === "M1")?.status,
		).toBe("complete");
		expect(state.execution.activeWorktrees).toHaveLength(0);
		expect(existsSync(path.join(root, result.auditPath ?? ""))).toBe(true);
		expect(readFileSync(path.join(root, "notes.txt"), "utf8")).toContain(
			"unique branch change",
		);
	});
});
