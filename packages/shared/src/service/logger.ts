export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| LogValue[]
	| { [key: string]: LogValue };

export interface LogContext {
	[key: string]: LogValue;
}

export interface LogEntry {
	ts: string;
	level: LogLevel;
	message: string;
	context?: LogContext;
}

export interface Logger {
	debug(context: LogContext, message: string): void;
	info(context: LogContext, message: string): void;
	warn(context: LogContext, message: string): void;
	error(context: LogContext, message: string): void;
	child(context: LogContext): Logger;
}

interface LoggerSink {
	stdout(line: string): void;
	stderr(line: string): void;
}

interface CreateLoggerOptions {
	context?: LogContext;
	sink?: LoggerSink;
	clock?: () => Date;
}

const defaultSink: LoggerSink = {
	stdout(line: string): void {
		process.stdout.write(line);
	},
	stderr(line: string): void {
		process.stderr.write(line);
	},
};

function normalizeValue(value: unknown): LogValue {
	if (value == null) return value;
	if (typeof value === "string") return value;
	if (typeof value === "number") return value;
	if (typeof value === "boolean") return value;
	if (value instanceof Error) {
		return {
			name: value.name,
			message: value.message,
			stack: value.stack ?? "",
		};
	}
	if (Array.isArray(value)) {
		return value.map((entry) => normalizeValue(entry));
	}
	if (typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, normalizeValue(entry)]),
		);
	}
	return String(value);
}

function mergeContext(
	base: LogContext,
	next: LogContext,
): LogContext | undefined {
	const merged = {
		...Object.fromEntries(
			Object.entries(base).map(([key, value]) => [key, normalizeValue(value)]),
		),
		...Object.fromEntries(
			Object.entries(next).map(([key, value]) => [key, normalizeValue(value)]),
		),
	};
	return Object.keys(merged).length > 0 ? merged : undefined;
}

function writeEntry(
	level: LogLevel,
	message: string,
	context: LogContext | undefined,
	sink: LoggerSink,
	clock: () => Date,
): void {
	const entry: LogEntry = {
		ts: clock().toISOString(),
		level,
		message,
		...(context ? { context } : {}),
	};
	const line = `${JSON.stringify(entry)}\n`;
	if (level === "warn" || level === "error") {
		sink.stderr(line);
		return;
	}
	sink.stdout(line);
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
	const baseContext = options.context ?? {};
	const sink = options.sink ?? defaultSink;
	const clock = options.clock ?? (() => new Date());

	function withLevel(
		level: LogLevel,
		context: LogContext,
		message: string,
	): void {
		writeEntry(level, message, mergeContext(baseContext, context), sink, clock);
	}

	return {
		debug(context: LogContext, message: string): void {
			withLevel("debug", context, message);
		},
		info(context: LogContext, message: string): void {
			withLevel("info", context, message);
		},
		warn(context: LogContext, message: string): void {
			withLevel("warn", context, message);
		},
		error(context: LogContext, message: string): void {
			withLevel("error", context, message);
		},
		child(context: LogContext): Logger {
			return createLogger({
				context: mergeContext(baseContext, context),
				sink,
				clock,
			});
		},
	};
}

export const logger = createLogger();
