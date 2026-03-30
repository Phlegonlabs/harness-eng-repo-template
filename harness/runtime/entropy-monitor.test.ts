import { afterEach, describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { ensureEntropyBaseline, updateEntropyDelta } from "./entropy-monitor";
import { createRepoWithTasks, makeTask } from "./orchestration-test-fixtures";

const tempRoots: string[] = [];

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("entropy monitor", () => {
	it("captures a baseline and records a delta for the active task", () => {
		const root = createRepoWithTasks(
			[makeTask({ id: "T101", status: "in_progress" })],
			tempRoots,
		);

		ensureEntropyBaseline(root, "T101");
		const delta = updateEntropyDelta({
			root,
			taskId: "T101",
			sourceEvent: "test",
		});

		expect(delta?.taskId).toBe("T101");
		expect(delta?.current.trackedFiles).toBeGreaterThan(0);
	});
});
