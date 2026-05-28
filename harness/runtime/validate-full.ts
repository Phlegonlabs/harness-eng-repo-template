import { captureConsole, printCapturedLines } from "./output-control";
import { loadState, saveState } from "./planning";
import { writeReportArtifact } from "./report-artifacts";
import { repoRoot } from "./shared";
import { runValidationEntry } from "./validation-entry";
import {
	appendValidationRun,
	statusFromCommandResult,
} from "./validation-state";
import { fullValidationSteps } from "./validation-steps";

const root = repoRoot();
const quietSuccess = process.argv.includes("--quiet-success");
const persistState = !process.argv.includes("--no-state");

const captured = captureConsole(() =>
	runValidationEntry({
		root,
		title: "harness validate:full",
		subtitle: `Full validation suite — ${new Date().toISOString()}`,
		quietSuccess,
		steps: fullValidationSteps(root),
	}),
);
printCapturedLines(captured.lines);

const artifactPath = writeReportArtifact(
	root,
	"validations",
	"validate-full-latest.json",
	{
		version: "1.0.0",
		source: "validate_full",
		status: statusFromCommandResult(captured.result, captured.lines),
		runAt: new Date().toISOString(),
		code: captured.result,
		lines: captured.lines,
	},
);
if (persistState) {
	const state = loadState(root);
	appendValidationRun(state, {
		source: "validate_full",
		status: statusFromCommandResult(captured.result, captured.lines),
		runAt: new Date().toISOString(),
		artifactPath,
		summary: captured.lines.slice(-4),
	});
	saveState(root, state);
}

process.exit(captured.result);
