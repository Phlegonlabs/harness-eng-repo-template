import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	clearTrackedFilesCache,
	gitHasCommits,
	trackedFiles,
	writeTextFile,
} from "./shared";
import type { ValidationContext } from "./types";
import { runRequiredFilesTest } from "./validation";

const tempRoots: string[] = [];

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
	clearTrackedFilesCache();
});

function createRepo(files: Record<string, string>): string {
	const root = mkdtempSync(path.join(os.tmpdir(), "harness-validation-files-"));
	tempRoots.push(root);
	const baseFiles: Record<string, string> = {
		"apps/api/package.json": '{"name":"@repo/api","private":true}',
		"apps/web/package.json": '{"name":"@repo/web","private":true}',
		"packages/shared/package.json": '{"name":"@repo/shared","private":true}',
	};
	for (const [relativePath, content] of Object.entries({
		...baseFiles,
		...files,
	})) {
		const absolutePath = path.join(root, relativePath);
		mkdirSync(path.dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, `${content}\n`);
	}
	return root;
}

function context(root: string): ValidationContext {
	return {
		repoRoot: root,
		config: {
			version: "1.0.0",
			level: 2,
			project_name: "test",
			project_owner: "",
			workspace_roots: ["apps", "packages"],
			default_workspaces: ["apps/api", "apps/web", "packages/shared"],
			layers: ["types", "config", "repo", "service", "runtime", "ui"],
			validation: {
				structural_tests: true,
				linters: true,
				entropy_scans: true,
				doc_freshness_days: 30,
			},
			contextManagement: {
				enabled: true,
				autoCompact: true,
				summaryMaxLines: 12,
				retainRecentArtifacts: 3,
				historyLimit: 25,
			},
			guardians: {
				enabled: true,
				preflight: true,
				stop: true,
				drift: true,
				logFailures: true,
			},
			entropy: {
				enabled: true,
				driftThresholdPercent: 10,
				baselineOnTaskStart: true,
			},
			commit_format: "conventional",
			required_files: [],
		},
		dependencyRules: {
			internal_import_roots: [],
			internal_import_aliases: {},
			layers: [],
		},
		fileSizeRules: { default_limit: 500, rules: [], excluded_patterns: [] },
		namingRules: { rules: [], excluded_patterns: [], case_patterns: {} },
		forbiddenRules: { rules: [] },
	};
}

function captureRequiredFiles(root: string) {
	const lines: string[] = [];
	const original = console.log;
	console.log = (...args: unknown[]) => {
		lines.push(args.join(" "));
	};
	try {
		return {
			code: runRequiredFilesTest(context(root)),
			output: lines.join("\n"),
		};
	} finally {
		console.log = original;
	}
}

describe("gitHasCommits", () => {
	it("returns false for a repository with no commits", () => {
		const root = mkdtempSync(path.join(os.tmpdir(), "harness-git-state-"));
		tempRoots.push(root);
		execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });

		expect(gitHasCommits(root)).toBe(false);
	});
});

describe("trackedFiles cache", () => {
	it("invalidates when writeTextFile writes a new file under the same repo", () => {
		const root = createRepo({
			"README.md": "# test",
		});
		const before = trackedFiles(root);

		writeTextFile(path.join(root, "notes.md"), "# notes\n");

		const after = trackedFiles(root);

		expect(before).not.toContain("notes.md");
		expect(after).toContain("notes.md");
	});
});

describe("runRequiredFilesTest", () => {
	it("requires AGENTS.md in every configured workspace", () => {
		const root = createRepo({
			"apps/api/AGENTS.md": "# api",
			"packages/shared/AGENTS.md": "# shared",
		});

		const result = captureRequiredFiles(root);

		expect(result.code).toBe(1);
		expect(result.output).toContain(
			"Missing workspace AGENTS.md: apps/web/AGENTS.md",
		);
	});

	it("passes when every configured workspace has AGENTS.md", () => {
		const root = createRepo({
			"apps/api/AGENTS.md": "# api",
			"apps/web/AGENTS.md": "# web",
			"packages/shared/AGENTS.md": "# shared",
		});

		const result = captureRequiredFiles(root);

		expect(result.code).toBe(0);
		expect(result.output).toContain("PASS: apps/web/AGENTS.md");
	});
});
