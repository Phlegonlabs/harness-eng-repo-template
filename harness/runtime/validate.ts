import { repoRoot } from "./shared";
import { runValidationEntry } from "./validation-entry";
import { fastValidationSteps } from "./validation-steps";

const root = repoRoot();
const quietSuccess = process.argv.includes("--quiet-success");

process.exit(
	runValidationEntry({
		root,
		title: "harness validate",
		subtitle: `Fast local validation suite — ${new Date().toISOString()}`,
		quietSuccess,
		steps: fastValidationSteps(root),
	}),
);
