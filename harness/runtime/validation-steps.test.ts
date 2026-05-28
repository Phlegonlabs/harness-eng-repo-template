import { describe, expect, it } from "bun:test";
import { fastValidationSteps, fullValidationSteps } from "./validation-steps";

describe("validation steps", () => {
	it("keeps validate:full as a strict superset of the fast suite", () => {
		const normalize = (label: string) => label.replace(/^\d+\.\s+/, "");
		const fastLabels = fastValidationSteps().map((step) =>
			normalize(step.label),
		);
		const fullLabels = fullValidationSteps().map((step) =>
			normalize(step.label),
		);

		for (const label of fastLabels) {
			expect(fullLabels).toContain(label);
		}
		expect(fullLabels).toContain("Structural Tests");
		expect(fullLabels.length).toBeGreaterThan(fastLabels.length);
	});
});
