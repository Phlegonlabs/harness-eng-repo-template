import path from "node:path";
import { repoRelative, writeTextFile } from "./shared";

function safeTimestamp(value: string): string {
	return value.replace(/[:.]/g, "-");
}

export function logDir(root: string): string {
	return path.join(root, ".harness", "logs");
}

export function writeRuntimeLog(options: {
	root: string;
	category: string;
	lines: string[];
}): string | null {
	const { root, category, lines } = options;
	if (lines.length === 0) {
		return null;
	}
	const target = path.join(
		logDir(root),
		`${category}-${safeTimestamp(new Date().toISOString())}.log`,
	);
	writeTextFile(target, `${lines.join("\n").trimEnd()}\n`);
	return repoRelative(root, target);
}

export function summarizeLines(
	lines: string[],
	maxLines: number,
): { snippet: string[]; truncated: boolean } {
	if (lines.length <= maxLines) {
		return { snippet: lines, truncated: false };
	}
	return {
		snippet: lines.slice(-maxLines),
		truncated: true,
	};
}
