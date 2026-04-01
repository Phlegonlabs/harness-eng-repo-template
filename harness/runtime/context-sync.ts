import {
	CANONICAL_CONTEXT_PATHS,
	readContextManifest,
	syncContextSources,
} from "./context";
import { repoRoot } from "./shared";

function usage(): string {
	return [
		"Usage:",
		"  bun run harness:context:sync --product <path> --architecture <path>",
		"  bun run harness:context:sync --design-system <path> --components <path>",
		"  bun run harness:context:sync --wireframes <path>",
		"",
		"Canonical targets:",
		`  product       -> ${CANONICAL_CONTEXT_PATHS.product}`,
		`  architecture  -> ${CANONICAL_CONTEXT_PATHS.architecture}`,
		`  design-system -> ${CANONICAL_CONTEXT_PATHS.designSystem}`,
		`  components    -> ${CANONICAL_CONTEXT_PATHS.components}`,
		`  wireframes    -> ${CANONICAL_CONTEXT_PATHS.wireframesDir}`,
	].join("\n");
}

function readFlag(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	if (index === -1) {
		return undefined;
	}
	return args[index + 1];
}

const args = process.argv.slice(2);
if (args.includes("--help")) {
	console.log(usage());
	process.exit(0);
}

const root = repoRoot();
const options = {
	product: readFlag(args, "--product"),
	architecture: readFlag(args, "--architecture"),
	designSystem: readFlag(args, "--design-system"),
	components: readFlag(args, "--components"),
	wireframes: readFlag(args, "--wireframes"),
};

if (
	!options.product &&
	!options.architecture &&
	!options.designSystem &&
	!options.components &&
	!options.wireframes
) {
	const manifest = readContextManifest(root);
	console.log("Harness Context");
	console.log(`  Manifest: ${CANONICAL_CONTEXT_PATHS.manifest}`);
	console.log(`  Last sync: ${manifest.syncedAt ?? "-"}`);
	if (manifest.entries.length === 0) {
		console.log("  Entries: none");
		console.log(usage());
		process.exit(0);
	}
	console.log("  Entries:");
	for (const entry of manifest.entries) {
		console.log(
			`    ${entry.kind}: ${entry.source} -> ${entry.target} (${entry.mode})`,
		);
	}
	process.exit(0);
}

const result = syncContextSources(root, options);
console.log("Context Sync");
console.log(`  Manifest: ${CANONICAL_CONTEXT_PATHS.manifest}`);
console.log(`  Updated: ${result.updated.length}`);
for (const entry of result.updated) {
	console.log(`    ${entry.kind}: ${entry.source} -> ${entry.target}`);
}
