import { collectGoldenPrincipleFindings } from "./golden-principles";
import { writeReportArtifact } from "./report-artifacts";
import { repoRoot } from "./shared";
import type { ValidationContext } from "./types";
import {
	runConsistencyScan,
	runDriftScan,
	runOrphanScan,
	validationContext,
} from "./validation";

function runStep(name: string, step: () => number): void {
	console.log(`── ${name} ──────────────────────────────────`);
	step();
	console.log("");
}

export function runEntropyScans(
	context: ValidationContext = validationContext(repoRoot()),
): number {
	const root = context.repoRoot;
	const reportMode = process.argv.includes("--report");
	runStep("Drift Detection", () => runDriftScan(context));
	runStep("Orphan Detection", () => runOrphanScan(context));
	runStep("Consistency Check", () => runConsistencyScan(context));
	runStep("Golden Principles", () => {
		const findings = collectGoldenPrincipleFindings(context);
		if (findings.length === 0) {
			console.log("PASS: No golden-principle violations found.");
			return 0;
		}
		for (const finding of findings) {
			console.log(
				`${finding.severity === "error" ? "FAIL" : "WARN"}: ${finding.principleId} ${finding.file}:${finding.line}`,
			);
			console.log(`  ${finding.message}`);
		}
		console.log("");
		console.log(
			`WARN: ${findings.length} golden-principle violation(s) found.`,
		);
		return 0;
	});

	console.log("════════════════════════════════════════════");
	console.log("INFO: Entropy scans complete. Review warnings above.");
	if (reportMode) {
		const reportPath = writeReportArtifact(
			root,
			"entropy",
			"latest-report.json",
			{
				version: "1.0.0",
				generatedAt: new Date().toISOString(),
				goldenPrincipleFindings: collectGoldenPrincipleFindings(context),
			},
		);
		console.log(`Report artifact: ${reportPath}`);
	}
	return 0;
}

if (import.meta.main) {
	process.exit(runEntropyScans(validationContext(repoRoot())));
}
