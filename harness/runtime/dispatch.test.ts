import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { completeDispatch, prepareDispatch } from "./dispatch";
import { orchestrateTask } from "./orchestration";
import { createRepo } from "./orchestration-test-fixtures";
import { loadState } from "./planning";

const tempRoots: string[] = [];

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("dispatch artifacts", () => {
	it("prepares a sidecar packet from the active task", () => {
		const root = createRepo(["bun --version"], tempRoots);
		orchestrateTask(root);

		const prepared = prepareDispatch({ root, role: "sidecar" });
		const state = loadState(root);

		expect(prepared.packet.role).toBe("sidecar");
		expect(prepared.packet.taskId).toBe("T101");
		expect(state.dispatch.latestPacketPath).toContain(".harness/dispatch/");
		expect(state.dispatch.queuedSidecars).toContain(prepared.packet.packetId);
	});

	it("stores a completed dispatch result and clears the queue", () => {
		const root = createRepo(["bun --version"], tempRoots);
		orchestrateTask(root);
		const prepared = prepareDispatch({ root, role: "sidecar" });
		const resultFile = path.join(
			mkdtempSync(path.join(os.tmpdir(), "harness-dispatch-result-")),
			"result.json",
		);
		tempRoots.push(path.dirname(resultFile));
		writeFileSync(
			resultFile,
			JSON.stringify(
				{
					version: "1.0.0",
					packetId: prepared.packet.packetId,
					role: "sidecar",
					summary: "Investigated the current task.",
					sources: [
						{ file: "apps/api/src/index.ts", line: 1, note: "entrypoint" },
					],
					recommendedNextAction: "Continue implementation.",
					risks: [],
					completedAt: new Date().toISOString(),
				},
				null,
				2,
			),
		);

		const completed = completeDispatch({
			root,
			packetId: prepared.packet.packetId,
			resultPath: resultFile,
		});
		const state = loadState(root);

		expect(completed.storedResultPath).toContain(".harness/dispatch-results/");
		expect(state.dispatch.latestResultPath).toContain(
			".harness/dispatch-results/",
		);
		expect(state.dispatch.queuedSidecars).not.toContain(
			prepared.packet.packetId,
		);
	});
});
