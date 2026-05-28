import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./shared";
import { cloneRepo, expectCommandSuccess } from "./test-support";

const root = repoRoot();
setDefaultTimeout(20000);

describe("guardian command", () => {
	it("runs preflight in a cloned repo", () => {
		const tempRoot = cloneRepo(root);

		const result = expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:guardian",
			"--mode",
			"preflight",
		]);

		expect(result.code).toBe(0);
		expect(
			result.stdout.includes("PASS") || result.stdout.includes("Guardian"),
		).toBe(true);
	});

	it("writes guardian artifacts for stop mode", () => {
		const tempRoot = cloneRepo(root);

		const result = expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:guardian",
			"--mode",
			"stop",
		]);

		expect(result.code).toBe(0);
		expect(
			existsSync(path.join(tempRoot, ".harness/guardians/stop-latest.json")),
		).toBe(true);
	});

	it("supports quiet-success output for stop mode", () => {
		const tempRoot = cloneRepo(root);

		const result = expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:guardian",
			"--mode",
			"stop",
			"--quiet-success",
			"--no-state",
		]);

		expect(result.code).toBe(0);
		expect(result.stdout).not.toContain("PASS: Guardian stop checks passed.");
		if (result.stdout.trim().length > 0) {
			expect(
				result.stdout.includes("WARN") ||
					result.stdout.includes("Entropy") ||
					result.stdout.includes("PASS with warnings"),
			).toBe(true);
		}
	});
});
