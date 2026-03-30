export interface CapturedOutput<T> {
	result: T;
	lines: string[];
}

function stringifyArgs(args: unknown[]): string {
	return args
		.map((value) => {
			if (typeof value === "string") return value;
			if (value instanceof Error) return value.stack ?? value.message;
			return String(value);
		})
		.join(" ");
}

export function captureConsole<T>(run: () => T): CapturedOutput<T> {
	const lines: string[] = [];
	const originalLog = console.log;
	const originalError = console.error;

	console.log = (...args: unknown[]) => {
		lines.push(stringifyArgs(args));
	};
	console.error = (...args: unknown[]) => {
		lines.push(stringifyArgs(args));
	};

	try {
		return { result: run(), lines };
	} finally {
		console.log = originalLog;
		console.error = originalError;
	}
}

export function printCapturedLines(lines: string[]): void {
	for (const line of lines) {
		console.log(line);
	}
}

export function hasAdvisoryOrFailureSignal(lines: string[]): boolean {
	return lines.some((line) => /\b(?:WARN|FAIL)\b/.test(line));
}
