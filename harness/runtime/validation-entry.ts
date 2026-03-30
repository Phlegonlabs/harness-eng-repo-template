import { captureConsole, hasAdvisoryOrFailureSignal } from "./output-control";
import { summarizeLines, writeRuntimeLog } from "./runtime-logs";
import { writeSection } from "./shared";

export interface ValidationStep {
	label: string;
	run: () => number;
	hard: boolean;
}

export function runValidationEntry(options: {
	root: string;
	title: string;
	subtitle: string;
	steps: ValidationStep[];
	quietSuccess: boolean;
}): number {
	const { root, title, subtitle, steps, quietSuccess } = options;

	if (!quietSuccess) {
		let hardErrors = 0;
		console.log(title);
		console.log("════════════════════════════════════════════");
		console.log(subtitle);
		for (const step of steps) {
			writeSection(step.label);
			const result = step.run();
			console.log("");
			if (result === 0) {
				console.log(`  ✓ ${step.label} passed`);
			} else if (step.hard) {
				console.log(`  ✗ ${step.label} FAILED (blocking)`);
				hardErrors += 1;
			} else {
				console.log(`  ⚠ ${step.label} reported warnings (advisory)`);
			}
		}
		console.log("");
		console.log("════════════════════════════════════════════");
		if (hardErrors > 0) {
			console.log(`FAIL: ${hardErrors} step(s) failed.`);
			return 1;
		}
		console.log("PASS: All validation checks passed.");
		return 0;
	}

	let hardErrors = 0;
	let advisorySteps = 0;
	for (const step of steps) {
		const captured = captureConsole(() => step.run());
		const shouldEmit =
			captured.result !== 0 || hasAdvisoryOrFailureSignal(captured.lines);
		if (!shouldEmit) {
			continue;
		}
		writeSection(step.label);
		const logPath = writeRuntimeLog({
			root,
			category: `validation-${step.label
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")}`,
			lines: captured.lines,
		});
		const { snippet, truncated } = summarizeLines(captured.lines, 12);
		for (const line of snippet) {
			console.log(line);
		}
		if (logPath && (truncated || captured.result !== 0)) {
			console.log(`  INFO: Full output logged at ${logPath}`);
		}
		console.log("");
		if (captured.result !== 0 && step.hard) {
			console.log(`  ✗ ${step.label} FAILED (blocking)`);
			hardErrors += 1;
		} else {
			console.log(`  ⚠ ${step.label} emitted advisory output`);
			advisorySteps += 1;
		}
	}

	if (hardErrors > 0) {
		console.log(`FAIL: ${hardErrors} step(s) failed.`);
		return 1;
	}
	if (advisorySteps > 0) {
		console.log(
			`PASS with warnings: ${advisorySteps} step(s) emitted advisory output.`,
		);
		return 0;
	}
	console.log("PASS: All validation checks passed.");
	return 0;
}
