import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveObservabilityProfile } from "./observability";
import { repoRoot } from "./shared";

const queryIndex = process.argv.indexOf("--query");
const query =
	queryIndex >= 0 && process.argv.length > queryIndex + 1
		? process.argv[queryIndex + 1]
		: "";

const root = repoRoot();
const resolved = resolveObservabilityProfile(root);

console.log("harness logs");
console.log("════════════════════════════════════════════");

if (resolved.error || !resolved.profile?.logFiles?.length) {
	console.log(
		`BLOCKED: ${resolved.error ?? "Active profile has no configured log files."}`,
	);
	process.exit(1);
}

const matches: string[] = [];
for (const relativeOrAbsolutePath of resolved.profile.logFiles) {
	const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
		? relativeOrAbsolutePath
		: path.join(root, relativeOrAbsolutePath);
	if (!existsSync(absolutePath)) {
		continue;
	}
	const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
	lines.forEach((line, index) => {
		if (!query || line.includes(query)) {
			matches.push(`${relativeOrAbsolutePath}:${index + 1}: ${line}`);
		}
	});
}

if (matches.length === 0) {
	console.log(
		query
			? `PASS: No log lines matched "${query}".`
			: "PASS: No log lines found.",
	);
	process.exit(0);
}

for (const match of matches.slice(0, 200)) {
	console.log(match);
}
process.exit(0);
