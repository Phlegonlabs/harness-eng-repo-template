import { repoRoot } from "./shared";
import { runValidationEntry } from "./validation-entry";
import { fullValidationSteps } from "./validation-steps";

const root = repoRoot();
const quietSuccess = process.argv.includes("--quiet-success");

process.exit(
	runValidationEntry({
		root,
		title: "harness validate:full",
		subtitle: `Full validation suite — ${new Date().toISOString()}`,
		quietSuccess,
		steps: fullValidationSteps(root),
	}),
);
