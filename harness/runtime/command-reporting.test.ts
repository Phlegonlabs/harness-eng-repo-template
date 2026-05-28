import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./shared";
import { cloneRepo, runCommand } from "./test-support";

const root = repoRoot();
const describeCommandReporting =
	process.env.HARNESS_SKIP_COMMAND_FLOW === "1" ? describe.skip : describe;
setDefaultTimeout(90000);

describeCommandReporting("command reporting failure paths", () => {
	it("returns a non-zero exit code for docs report failures", () => {
		const tempRoot = cloneRepo(root);
		appendFileSync(
			path.join(tempRoot, "docs/product.md"),
			"\n[Broken internal link](docs/does-not-exist.md)\n",
		);

		const result = runCommand(tempRoot, [
			"bun",
			"run",
			"harness:docs",
			"--report",
		]);

		expect(result.code).toBe(1);
		expect(result.stdout).toContain("FAIL:");
	});

	it("returns a non-zero exit code for self-review blocking findings", () => {
		const tempRoot = cloneRepo(root);
		appendFileSync(
			path.join(tempRoot, "apps/api/src/runtime/index.ts"),
			"\nconsole.log('forbidden');\n",
		);

		const result = runCommand(tempRoot, [
			"bun",
			"run",
			"harness:self-review",
			"--report",
		]);

		expect(result.code).toBe(1);
		expect(result.stdout).toContain("[FAIL]");
		expect(result.stdout).toContain("R-QUAL-02");
	});

	it("returns a non-zero exit code when quality gates fail", () => {
		const tempRoot = cloneRepo(root);
		const result = runCommand(tempRoot, [
			"bun",
			"run",
			"harness:quality",
			"--score",
			"--fail-under=101",
		]);

		expect(result.code).toBe(1);
		expect(result.stdout).toContain("Gate: FAIL");
		expect(result.stdout).toContain("Overall score");
	});
});
