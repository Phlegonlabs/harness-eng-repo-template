import { buildDocsReport } from "./docs-report";
import { writeReportArtifact } from "./report-artifacts";
import { repoRoot } from "./shared";
import { validationContext } from "./validation";

const root = repoRoot();
const context = validationContext(root);
const report = buildDocsReport(context);
const reportPath = writeReportArtifact(
	root,
	"docs",
	"latest-report.json",
	report,
);
const jsonMode = process.argv.includes("--json");
const freshnessMode =
	process.argv.includes("--freshness") || process.argv.includes("--report");
const linksMode =
	process.argv.includes("--links") || process.argv.includes("--report");
const staleMode = process.argv.includes("--stale");

if (jsonMode) {
	console.log(JSON.stringify({ ...report, reportPath }, null, 2));
	process.exit(
		report.freshness.some((finding) => finding.severity === "error") ||
			report.brokenLinks.length > 0
			? 1
			: 0,
	);
}

console.log("harness docs");
console.log("════════════════════════════════════════════");

if (freshnessMode || staleMode) {
	if (report.freshness.length === 0) {
		console.log("PASS: All tracked docs satisfy freshness rules.");
	} else {
		for (const finding of report.freshness) {
			console.log(
				`${finding.severity.toUpperCase()}: ${finding.doc} — ${finding.message}`,
			);
		}
	}
	console.log("");
}

if (linksMode) {
	if (report.brokenLinks.length === 0) {
		console.log("PASS: All tracked docs links resolve.");
	} else {
		for (const brokenLink of report.brokenLinks) {
			console.log(`FAIL: ${brokenLink.file} -> ${brokenLink.link}`);
		}
	}
	console.log("");
}

if (process.argv.includes("--report")) {
	console.log(`Report artifact: ${reportPath}`);
}

process.exit(
	report.freshness.some((finding) => finding.severity === "error") ||
		report.brokenLinks.length > 0
		? 1
		: 0,
);
