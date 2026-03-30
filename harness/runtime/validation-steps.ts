import { runDoctor } from "./doctor";
import { runEntropyScans } from "./entropy-all";
import { runLintSuite } from "./lint-all";
import { repoRoot } from "./shared";
import { runStructuralTests } from "./test-all";
import {
	runArchitectureTest,
	runDocLinksTest,
	runRequiredFilesTest,
	runTemplateIdentityTest,
	validationContext,
} from "./validation";
import type { ValidationStep } from "./validation-entry";

export function fastValidationSteps(
	root: string = repoRoot(),
): ValidationStep[] {
	const context = validationContext(root);
	return [
		{ label: "1. Health Check", run: () => runDoctor(root), hard: true },
		{ label: "2. Linters", run: () => runLintSuite(context), hard: true },
		{
			label: "3. Required Files",
			run: () => runRequiredFilesTest(context),
			hard: true,
		},
		{
			label: "4. Architecture Compliance",
			run: () => runArchitectureTest(context),
			hard: true,
		},
		{
			label: "5. Template Identity",
			run: () => runTemplateIdentityTest(context),
			hard: true,
		},
		{
			label: "6. Document Links",
			run: () => runDocLinksTest(context),
			hard: true,
		},
		{
			label: "7. Entropy Scans",
			run: () => runEntropyScans(context),
			hard: false,
		},
	];
}

export function fullValidationSteps(
	root: string = repoRoot(),
): ValidationStep[] {
	const context = validationContext(root);
	return [
		{ label: "1. Health Check", run: () => runDoctor(root), hard: true },
		{ label: "2. Linters", run: () => runLintSuite(context), hard: true },
		{
			label: "3. Structural Tests",
			run: () => runStructuralTests(root, context),
			hard: true,
		},
		{
			label: "4. Entropy Scans",
			run: () => runEntropyScans(context),
			hard: false,
		},
	];
}
