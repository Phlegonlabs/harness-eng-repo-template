import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommandWithCapture } from "./command-runner";

const tempRoots: string[] = [];

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

function createTempRoot(): string {
	const root = mkdtempSync(path.join(os.tmpdir(), "harness-command-runner-"));
	tempRoots.push(root);
	return root;
}

describe("runCommandWithCapture", () => {
	it("retries infrastructure-style failures and reports recovered execution", () => {
		const root = createTempRoot();
		const markerPath = path.join(root, "retry-marker.txt").replace(/\\/g, "/");
		const commandLine = `node -e "const fs=require('node:fs'); const marker='${markerPath}'; if(!fs.existsSync(marker)){ fs.writeFileSync(marker,'1'); setTimeout(() => process.exit(0), 200); } else { process.stdout.write('recovered'); }"`;

		const result = runCommandWithCapture({
			root,
			commandLine,
			logCategory: "command-runner-test",
			maxSnippetLines: 5,
			timeoutMs: 50,
			maxRetriesOnInfrastructureFailure: 1,
			baseBackoffMs: 0,
			maxBackoffMs: 0,
		});

		expect(result.exitCode).toBe(0);
		expect(result.recovered).toBe(true);
		expect(result.attemptCount).toBe(2);
		expect(result.timedOut).toBe(true);
		expect(result.logPath).toContain(".harness/logs/");
		expect(result.attempts[0]?.status).toBe("timed_out");
		expect(result.attempts[1]?.status).toBe("passed");
	});

	it("stops after the configured retry budget on repeated infrastructure failure", () => {
		const root = createTempRoot();
		const commandLine =
			"node -e \"setTimeout(() => process.stdout.write('slow'), 200)\"";

		const result = runCommandWithCapture({
			root,
			commandLine,
			logCategory: "command-runner-timeout-test",
			maxSnippetLines: 5,
			timeoutMs: 50,
			maxRetriesOnInfrastructureFailure: 1,
			baseBackoffMs: 0,
			maxBackoffMs: 0,
		});

		expect(result.exitCode).toBe(1);
		expect(result.attemptCount).toBe(2);
		expect(result.timedOut).toBe(true);
		expect(result.recovered).toBe(false);
		expect(result.logPath).toContain(".harness/logs/");
		expect(
			result.attempts.every((attempt) => attempt.status === "timed_out"),
		).toBe(true);
	});
});
