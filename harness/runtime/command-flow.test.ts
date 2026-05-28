import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./shared";
import {
	answerDiscovery,
	cloneRepo,
	copyRepoScaffold,
	expectCommandSuccess,
	expectPersistentBoot,
	firstTaskId,
} from "./test-support";

const root = repoRoot();
const describeCommandFlow =
	process.env.HARNESS_SKIP_COMMAND_FLOW === "1" ? describe.skip : describe;
setDefaultTimeout(90000);

describeCommandFlow("command flow", () => {
	it("keeps the ready-baseline command surface honest before personalization", () => {
		const tempRoot = cloneRepo(root);
		for (const hook of ["pre-commit", "commit-msg", "pre-push"]) {
			expect(existsSync(path.join(tempRoot, ".git/hooks", hook))).toBe(true);
		}
		const doctor = expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:doctor",
		]);
		expect(doctor.stdout).toContain("Project name is still 'harness-template'");
		for (const command of [
			["bun", "run", "harness:lint"],
			["bun", "run", "harness:structural"],
			["bun", "run", "harness:entropy"],
			["bun", "run", "harness:validate"],
			["bun", "run", "harness:self-review"],
			["bun", "run", "harness:status", "--json"],
			["bun", "run", "harness:compact"],
			["bun", "run", "harness:guardian", "--mode", "preflight"],
			["bun", "run", "harness:state-recover", "--list"],
			["bun", "run", "build"],
			["bun", "run", "lint"],
			["bun", "run", "lint:root"],
			["bun", "run", "lint:biome"],
			["bun", "run", "typecheck"],
			["bun", "run", "typecheck:root"],
			["bun", "run", "test"],
			["bun", "run", "check"],
			["bun", "run", "format:check"],
			["bun", "run", "harness:discover"],
		] as const) {
			expectCommandSuccess(tempRoot, command);
		}

		expectCommandSuccess(tempRoot, ["bun", "run", "harness:plan"]);

		const orchestrate = expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:orchestrate",
		]);
		expect(orchestrate.stdout).toContain("Orchestrator Status");

		const evaluate = expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:evaluate",
		]);
		expect(evaluate.stdout).toContain("Evaluator Status");
	});

	it("initializes cleanly from a downloaded scaffold without git metadata", () => {
		const tempRoot = copyRepoScaffold(root);
		const install = expectCommandSuccess(tempRoot, ["bun", "install"]);
		expect(install.stderr).not.toContain("fatal: not a git repository");

		const init = expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:init",
			"--",
			"downloaded-project",
		]);
		expect(init.stderr).not.toContain("fatal: not a git repository");
		expect(init.stdout).toContain("Initialized empty Git repository");

		const validate = expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:validate",
		]);
		expect(validate.stdout).not.toContain("ORPHAN:");
	});

	it("initializes without an owner and still validates the ready baseline", () => {
		const tempRoot = cloneRepo(root);
		expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:init",
			"--",
			"ready-project",
		]);

		const status = JSON.parse(
			expectCommandSuccess(tempRoot, ["bun", "run", "harness:status", "--json"])
				.stdout,
		) as { phase: string; nextAction: string };

		expect(status.phase).toBe("READY");
		expect(status.nextAction).toContain("harness:plan");
		expect(
			readFileSync(path.join(tempRoot, ".github/CODEOWNERS"), "utf8"),
		).not.toContain("@your-org/engineering");
		expect(
			readFileSync(path.join(tempRoot, "README.md"), "utf8"),
		).not.toContain("@your-org/engineering");
		const validate = expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:validate",
		]);
		expect(validate.stdout).not.toContain("ORPHAN:");
	});

	it("supports the full post-init root and workspace command surface", async () => {
		const tempRoot = cloneRepo(root);
		expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:init",
			"--",
			"delivery-project",
			"--owner",
			"@acme/engineering",
		]);
		expect(
			readFileSync(path.join(tempRoot, ".github/CODEOWNERS"), "utf8"),
		).toContain("@acme/engineering");
		expect(
			readFileSync(path.join(tempRoot, "apps/api/AGENTS.md"), "utf8"),
		).toContain("@delivery-project/shared");
		expect(
			readFileSync(
				path.join(tempRoot, "docs/internal/observability.md"),
				"utf8",
			),
		).toContain("@delivery-project/shared");
		expect(
			readFileSync(
				path.join(tempRoot, "harness/rules/forbidden-patterns.json"),
				"utf8",
			),
		).toContain("@delivery-project/shared");
		expectCommandSuccess(tempRoot, ["bun", "run", "harness:install-hooks"]);
		expectCommandSuccess(tempRoot, ["bun", "run", "format"]);
		expectCommandSuccess(tempRoot, ["bun", "run", "format:check"]);
		expectCommandSuccess(tempRoot, ["bun", "run", "check"]);
		expectCommandSuccess(tempRoot, ["bun", "run", "harness:plan"]);
		expectCommandSuccess(tempRoot, ["bun", "run", "harness:status", "--json"]);
		expectCommandSuccess(tempRoot, ["bun", "run", "check"]);
		expectCommandSuccess(tempRoot, ["bun", "run", "format:check"]);
		expectCommandSuccess(tempRoot, ["bun", "run", "harness:orchestrate"]);
		expect(
			existsSync(path.join(tempRoot, ".harness/compact/latest.json")),
		).toBe(true);
		expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:evaluate",
			"--task",
			firstTaskId(tempRoot),
		]);
		expect(existsSync(path.join(tempRoot, ".harness/compact/latest.md"))).toBe(
			true,
		);
		expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:dispatch",
			"--prepare",
			"--role",
			"sidecar",
		]);
		expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:state-recover",
			"--list",
		]);
		expectCommandSuccess(tempRoot, ["bun", "run", "check"]);
		expectCommandSuccess(tempRoot, ["bun", "run", "harness:validate:full"]);

		for (const workspace of [
			"apps/api",
			"apps/web",
			"packages/shared",
		] as const) {
			const workspaceRoot = path.join(tempRoot, workspace);
			expectCommandSuccess(workspaceRoot, ["bun", "run", "build"]);
			expectCommandSuccess(workspaceRoot, ["bun", "run", "lint"]);
			expectCommandSuccess(workspaceRoot, ["bun", "run", "typecheck"]);
			expectCommandSuccess(workspaceRoot, ["bun", "run", "test"]);
		}

		await expectPersistentBoot(tempRoot, ["bun", "run", "dev"]);
		await expectPersistentBoot(path.join(tempRoot, "apps/api"), [
			"bun",
			"run",
			"dev",
		]);
		await expectPersistentBoot(path.join(tempRoot, "apps/web"), [
			"bun",
			"run",
			"dev",
		]);
	});

	it("supports the discovery path before planning", () => {
		const tempRoot = cloneRepo(root);
		expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:discover",
			"--reset",
		]);
		expect(answerDiscovery(tempRoot, "sample-project").code).toBe(0);
		expectCommandSuccess(tempRoot, ["bun", "run", "harness:plan"]);
	});

	it("writes profile-specific layer rules during init", () => {
		const tempRoot = cloneRepo(root);
		expectCommandSuccess(tempRoot, [
			"bun",
			"run",
			"harness:init",
			"--",
			"sample-cli",
			"--profile",
			"cli",
		]);

		const config = JSON.parse(
			readFileSync(path.join(tempRoot, "harness/config.json"), "utf8"),
		) as { layers: string[] };
		const rules = JSON.parse(
			readFileSync(
				path.join(tempRoot, "harness/rules/dependency-layers.json"),
				"utf8",
			),
		) as { layers: Array<{ name: string }> };

		expect(config.layers).toEqual(["types", "config", "service", "runtime"]);
		expect(rules.layers.map((layer) => layer.name)).toEqual([
			"types",
			"config",
			"service",
			"runtime",
		]);
	});
});
