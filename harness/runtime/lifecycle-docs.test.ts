import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./shared";

describe("orchestrator workflow docs", () => {
	it("describes the runtime task lifecycle without phantom statuses", () => {
		const content = readFileSync(
			path.join(repoRoot(), "docs/internal/orchestrator-workflow.md"),
			"utf8",
		);

		expect(content).toContain(
			"pending -> in_progress -> evaluation_pending -> done",
		);
		expect(content).toContain("contractStatus");
		expect(content).toContain("evaluatorStatus");
		expect(content).not.toContain("contract_pending");
		expect(content).not.toContain("contract_approved");
	});
});
