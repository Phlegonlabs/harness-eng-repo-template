import { execFileSync } from "node:child_process";
import { summarizeLines, writeRuntimeLog } from "./runtime-logs";

export interface CommandAttemptResult {
	attempt: number;
	exitCode: number;
	lines: string[];
	snippet: string[];
	durationMs: number;
	logPath: string | null;
	status: "passed" | "failed" | "timed_out";
	infrastructureFailure: boolean;
}

export interface CommandCaptureResult {
	command: string;
	exitCode: number;
	lines: string[];
	snippet: string[];
	logPath: string | null;
	durationMs: number;
	attemptCount: number;
	recovered: boolean;
	timedOut: boolean;
	attempts: CommandAttemptResult[];
}

function tokenize(commandLine: string): string[] {
	return (commandLine.match(/"[^"]*"|'[^']*'|[^\s]+/g) ?? []).map((token) =>
		token.replace(/^['"]|['"]$/g, ""),
	);
}

function parseFailure(error: unknown): {
	exitCode: number;
	lines: string[];
	timedOut: boolean;
	infrastructureFailure: boolean;
} {
	const failure =
		typeof error === "object" && error
			? (error as {
					status?: number | null;
					stdout?: string | Buffer;
					stderr?: string | Buffer;
					code?: string;
					killed?: boolean;
					signal?: string | null;
					message?: string;
				})
			: {};
	const stdout =
		typeof failure.stdout === "string"
			? failure.stdout
			: (failure.stdout?.toString("utf8") ?? "");
	const stderr =
		typeof failure.stderr === "string"
			? failure.stderr
			: (failure.stderr?.toString("utf8") ?? "");
	const message = failure.message ?? "";
	const timedOut =
		failure.code === "ETIMEDOUT" ||
		message.includes("timed out") ||
		(Boolean(failure.killed) && Boolean(failure.signal));
	const infrastructureFailure =
		timedOut ||
		failure.code === "ENOENT" ||
		failure.code === "EAGAIN" ||
		failure.status === null ||
		failure.status === undefined;
	return {
		exitCode: failure.status ?? 1,
		lines: `${stdout}\n${stderr}`.trim().split(/\r?\n/).filter(Boolean),
		timedOut,
		infrastructureFailure,
	};
}

function sleepMs(durationMs: number): void {
	if (durationMs <= 0) return;
	const startedAt = Date.now();
	while (Date.now() - startedAt < durationMs) {
		// Intentional busy wait to keep the runner synchronous.
	}
}

function attemptLogLines(
	attempts: CommandAttemptResult[],
	maxAttempts: number,
	commandLine: string,
): string[] {
	const lines = [`Command: ${commandLine}`];
	for (const attempt of attempts) {
		lines.push(
			`[Attempt ${attempt.attempt}/${maxAttempts}] ${attempt.status} exit=${attempt.exitCode} duration=${attempt.durationMs}ms infra=${attempt.infrastructureFailure ? "yes" : "no"}`,
		);
		lines.push(...attempt.lines);
	}
	return lines;
}

export function runCommandWithCapture(options: {
	root: string;
	commandLine: string;
	logCategory: string;
	maxSnippetLines: number;
	timeoutMs?: number;
	maxRetriesOnInfrastructureFailure?: number;
	baseBackoffMs?: number;
	maxBackoffMs?: number;
}): CommandCaptureResult {
	const {
		root,
		commandLine,
		logCategory,
		maxSnippetLines,
		timeoutMs,
		maxRetriesOnInfrastructureFailure = 0,
		baseBackoffMs = 0,
		maxBackoffMs = baseBackoffMs,
	} = options;
	const [command, ...args] = tokenize(commandLine);
	if (!command) {
		return {
			command: commandLine,
			exitCode: 1,
			lines: ["Empty command."],
			snippet: ["Empty command."],
			logPath: null,
			durationMs: 0,
			attemptCount: 1,
			recovered: false,
			timedOut: false,
			attempts: [
				{
					attempt: 1,
					exitCode: 1,
					lines: ["Empty command."],
					snippet: ["Empty command."],
					durationMs: 0,
					logPath: null,
					status: "failed",
					infrastructureFailure: false,
				},
			],
		};
	}
	const attempts: CommandAttemptResult[] = [];
	const startedAt = Date.now();
	const maxAttempts = 1 + Math.max(maxRetriesOnInfrastructureFailure, 0);
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const attemptStartedAt = Date.now();
		try {
			const stdout = execFileSync(command, args, {
				cwd: root,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
				timeout: timeoutMs,
			});
			const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
			const { snippet } = summarizeLines(lines, maxSnippetLines);
			attempts.push({
				attempt,
				exitCode: 0,
				lines,
				snippet,
				durationMs: Date.now() - attemptStartedAt,
				logPath: null,
				status: "passed",
				infrastructureFailure: false,
			});
			const logPath =
				attempts.length > 1
					? writeRuntimeLog({
							root,
							category: logCategory,
							lines: attemptLogLines(attempts, maxAttempts, commandLine),
						})
					: null;
			return {
				command: commandLine,
				exitCode: 0,
				lines,
				snippet,
				logPath,
				durationMs: Date.now() - startedAt,
				attemptCount: attempts.length,
				recovered: attempts.length > 1,
				timedOut: attempts.some((entry) => entry.status === "timed_out"),
				attempts: attempts.map((entry) =>
					entry.logPath || !logPath ? entry : { ...entry, logPath },
				),
			};
		} catch (error) {
			const failure = parseFailure(error);
			const { snippet } = summarizeLines(failure.lines, maxSnippetLines);
			attempts.push({
				attempt,
				exitCode: failure.exitCode,
				lines: failure.lines,
				snippet,
				durationMs: Date.now() - attemptStartedAt,
				logPath: null,
				status: failure.timedOut ? "timed_out" : "failed",
				infrastructureFailure: failure.infrastructureFailure,
			});
			if (failure.infrastructureFailure && attempt < maxAttempts) {
				const delayMs = Math.min(
					baseBackoffMs * 2 ** (attempt - 1),
					maxBackoffMs,
				);
				sleepMs(delayMs);
				continue;
			}
			const logPath = writeRuntimeLog({
				root,
				category: logCategory,
				lines: attemptLogLines(attempts, maxAttempts, commandLine),
			});
			const latest = attempts[attempts.length - 1];
			return {
				command: commandLine,
				exitCode: latest.exitCode,
				lines: latest.lines,
				snippet: latest.snippet,
				logPath,
				durationMs: Date.now() - startedAt,
				attemptCount: attempts.length,
				recovered: false,
				timedOut: attempts.some((entry) => entry.status === "timed_out"),
				attempts: attempts.map((entry) => ({ ...entry, logPath })),
			};
		}
	}
	return {
		command: commandLine,
		exitCode: 1,
		lines: ["Command runner reached an unexpected terminal state."],
		snippet: ["Command runner reached an unexpected terminal state."],
		logPath: null,
		durationMs: Date.now() - startedAt,
		attemptCount: attempts.length,
		recovered: false,
		timedOut: false,
		attempts,
	};
}
