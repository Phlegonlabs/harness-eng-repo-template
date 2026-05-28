import { describe, expect, it } from "bun:test";
import {
	evaluateQualityGateFailures,
	resolveQualityGateOptions,
} from "./quality";
import type { QualityReport } from "./types";

const report: QualityReport = {
	version: "1.0.0",
	generatedAt: "2026-05-28T00:00:00.000Z",
	overallScore: 82,
	overallGrade: "B",
	dimensions: [
		{
			name: "type_safety",
			label: "Type Safety",
			score: 88,
			weight: 0.2,
			detail: "ok",
		},
		{
			name: "architectural_compliance",
			label: "Architectural Compliance",
			score: 95,
			weight: 0.2,
			detail: "ok",
		},
	],
};

describe("quality gates", () => {
	it("keeps local score mode read-only unless enforcement is requested", () => {
		const options = resolveQualityGateOptions(["--score"], {
			failUnderScore: 90,
			minGrade: "A",
		});

		expect(options.failUnderScore).toBeUndefined();
		expect(options.minGrade).toBeUndefined();
		expect(options.minDimensionScores).toEqual({});
	});

	it("merges config thresholds when --enforce-config is provided", () => {
		const options = resolveQualityGateOptions(
			["--score", "--enforce-config", "--min-grade=B"],
			{
				failUnderScore: 80,
				minGrade: "A",
				minDimensionScores: { type_safety: 90 },
			},
		);

		expect(options.failUnderScore).toBe(80);
		expect(options.minGrade).toBe("B");
		expect(options.minDimensionScores).toEqual({ type_safety: 90 });
	});

	it("reports threshold failures for overall and dimension scores", () => {
		const failures = evaluateQualityGateFailures(
			report,
			{
				failUnderScore: 90,
				minGrade: "A",
				minDimensionScores: { architectural_compliance: 100 },
			},
			{
				A: { min: 90, label: "Excellent" },
				B: { min: 75, label: "Good" },
				F: { min: 0, label: "Critical" },
			},
		);

		expect(failures).toHaveLength(3);
		expect(failures[0]).toContain("Overall score");
		expect(failures[1]).toContain("Overall grade");
		expect(failures[2]).toContain("Architectural Compliance");
	});
});
