import { afterEach, describe, expect, it } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	describeAvailableContext,
	readContextManifest,
	syncContextSources,
} from "./context";
import type { TaskRecord } from "./types";

const tempRoots: string[] = [];

function createRoot(): string {
	const root = mkdtempSync(path.join(os.tmpdir(), "harness-context-"));
	tempRoots.push(root);
	return root;
}

function write(root: string, relativePath: string, content: string): void {
	const target = path.join(root, relativePath);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, `${content}\n`);
}

function frontendTask(overrides?: Partial<TaskRecord>): TaskRecord {
	return {
		id: "T101",
		milestoneId: "M1",
		title: "Implement frontend screen",
		kind: "implementation",
		status: "pending",
		dependsOn: [],
		affectedFilesOrAreas: ["apps/web/src/ui/home.tsx"],
		requiredSkills: ["skills/implementation/SKILL.md"],
		validationChecks: [],
		evaluationGates: [],
		acceptanceCriteria: [],
		iteration: 0,
		contractStatus: "missing",
		evaluatorStatus: "pending",
		stallCount: 0,
		lastCheckpointAt: null,
		artifacts: {
			contractPath: null,
			latestEvaluationPath: null,
			latestHandoffPath: null,
		},
		...overrides,
	};
}

describe("context sync", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("replaces canonical text docs and records them in the manifest", () => {
		const root = createRoot();
		write(root, "external/product.md", "# Imported Product");
		write(root, "external/design-system.md", "# Imported Design System");

		syncContextSources(root, {
			product: "external/product.md",
			designSystem: "external/design-system.md",
		});

		expect(readFileSync(path.join(root, "docs/product.md"), "utf8")).toContain(
			"# Imported Product",
		);
		expect(
			readFileSync(path.join(root, "docs/design/design-system.md"), "utf8"),
		).toContain("# Imported Design System");

		const manifest = readContextManifest(root);
		expect(manifest.entries.map((entry) => entry.kind)).toEqual([
			"design-system",
			"product",
		]);
	});

	it("merges wireframe assets and refreshes the canonical index", () => {
		const root = createRoot();
		write(root, "imports/wireframes/home.md", "# Home");
		write(root, "imports/wireframes/mobile/checkout.txt", "checkout");
		write(root, "imports/wireframes/README.md", "# ignore me");

		syncContextSources(root, {
			wireframes: "imports/wireframes",
		});

		expect(
			readFileSync(path.join(root, "docs/design/wireframes/home.md"), "utf8"),
		).toContain("# Home");
		expect(
			readFileSync(
				path.join(root, "docs/design/wireframes/mobile/checkout.txt"),
				"utf8",
			),
		).toContain("checkout");
		expect(
			readFileSync(path.join(root, "docs/design/wireframes/index.md"), "utf8"),
		).toContain("docs/design/wireframes/home.md");
	});

	it("resolves frontend design refs when the canonical surfaces are populated", () => {
		const root = createRoot();
		write(root, "docs/product.md", "# Product");
		write(root, "docs/architecture.md", "# Architecture");
		write(root, "docs/design/overview.md", "# Design Context");
		write(root, "docs/design/design-system.md", "# Design System");
		write(root, "docs/design/components.md", "# Components");
		write(root, "docs/design/wireframes/index.md", "# Wireframes");
		write(root, "docs/design/wireframes/home.md", "# Home");

		const context = describeAvailableContext(root, frontendTask());

		expect(context.refs.map((ref) => ref.kind)).toEqual([
			"product",
			"architecture",
			"design-overview",
			"design-system",
			"components",
			"wireframes-index",
			"wireframes-assets",
		]);
		expect(context.advisories).toHaveLength(0);
	});

	it("adds advisories when frontend context is still missing", () => {
		const root = createRoot();
		write(root, "docs/product.md", "# Product");
		write(root, "docs/architecture.md", "# Architecture");
		write(
			root,
			"docs/design/design-system.md",
			"- [Describe the semantic color system.]",
		);

		const context = describeAvailableContext(root, frontendTask());

		expect(context.refs.map((ref) => ref.kind)).toEqual([
			"product",
			"architecture",
		]);
		expect(
			context.advisories.some((item) => item.includes("design-system.md")),
		).toBe(true);
		expect(
			context.advisories.some((item) => item.includes("wireframes/")),
		).toBe(true);
	});
});
