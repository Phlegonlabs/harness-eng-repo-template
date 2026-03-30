import { execFileSync } from "node:child_process";
import { summarizeLines, writeRuntimeLog } from "./runtime-logs";

export interface CommandCaptureResult {
	command: string;
	exitCode: number;
	lines: string[];
	snippet: string[];
	logPath: string | null;
}

function tokenize(commandLine: string): string[] {
	return (commandLine.match(/"[^"]*"|'[^']*'|[^\s]+/g) ?? []).map((token) =>
		token.replace(/^['"]|['"]$/g, ""),
	);
}

export function runCommandWithCapture(options: {
	root: string;
	commandLine: string;
	logCategory: string;
	maxSnippetLines: number;
}): CommandCaptureResult {
	const { root, commandLine, logCategory, maxSnippetLines } = options;
	const [command, ...args] = tokenize(commandLine);
	if (!command) {
		return {
			command: commandLine,
			exitCode: 1,
			lines: ["Empty command."],
			snippet: ["Empty command."],
			logPath: null,
		};
	}
	try {
		const stdout = execFileSync(command, args, {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
		const { snippet } = summarizeLines(lines, maxSnippetLines);
		return {
			command: commandLine,
			exitCode: 0,
			lines,
			snippet,
			logPath: null,
		};
	} catch (error) {
		const failure =
			typeof error === "object" && error
				? (error as {
						status?: number;
						stdout?: string | Buffer;
						stderr?: string | Buffer;
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
		const lines = `${stdout}\n${stderr}`.trim().split(/\r?\n/).filter(Boolean);
		const { snippet } = summarizeLines(lines, maxSnippetLines);
		return {
			command: commandLine,
			exitCode: failure.status ?? 1,
			lines,
			snippet,
			logPath: writeRuntimeLog({
				root,
				category: logCategory,
				lines,
			}),
		};
	}
}
