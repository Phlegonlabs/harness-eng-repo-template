import { describe, expect, test } from "bun:test";
import { createLogger } from "./logger";

describe("logger", () => {
	test("should write structured JSON to stdout for info logs", () => {
		const stdout: string[] = [];
		const logger = createLogger({
			sink: {
				stdout(line: string): void {
					stdout.push(line);
				},
				stderr(): void {},
			},
			clock: () => new Date("2026-03-29T00:00:00.000Z"),
		});

		logger.info({ requestId: "req-1" }, "request completed");

		expect(stdout).toHaveLength(1);
		expect(JSON.parse(stdout[0])).toEqual({
			ts: "2026-03-29T00:00:00.000Z",
			level: "info",
			message: "request completed",
			context: {
				requestId: "req-1",
			},
		});
	});

	test("should merge child context and route warnings to stderr", () => {
		const stderr: string[] = [];
		const logger = createLogger({
			context: {
				workspace: "api",
			},
			sink: {
				stdout(): void {},
				stderr(line: string): void {
					stderr.push(line);
				},
			},
			clock: () => new Date("2026-03-29T00:00:00.000Z"),
		}).child({ component: "healthcheck" });

		logger.warn({ statusCode: 503 }, "downstream unavailable");

		expect(stderr).toHaveLength(1);
		expect(JSON.parse(stderr[0])).toEqual({
			ts: "2026-03-29T00:00:00.000Z",
			level: "warn",
			message: "downstream unavailable",
			context: {
				workspace: "api",
				component: "healthcheck",
				statusCode: 503,
			},
		});
	});
});
