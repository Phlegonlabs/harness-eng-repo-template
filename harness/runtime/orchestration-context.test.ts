import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { orchestrateTask } from "./orchestration";
import { createRepoWithTasks, makeTask } from "./orchestration-test-fixtures";

const tempRoots: string[] = [];

describe("orchestration context injection", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("injects canonical context refs into frontend task contracts", () => {
		const root = createRepoWithTasks(
			[
				makeTask({
					id: "T101",
					title: "Implement storefront UI",
					affectedFilesOrAreas: ["apps/web/src/ui/storefront.tsx"],
				}),
			],
			tempRoots,
		);
		for (const [relativePath, content] of Object.entries({
			"docs/product.md": "# Product",
			"docs/architecture.md": "# Architecture",
			"docs/design/overview.md": "# Design Context",
			"docs/design/design-system.md": "# Design System",
			"docs/design/components.md": "# Components",
			"docs/design/wireframes/index.md": "# Wireframes",
			"docs/design/wireframes/home.md": "# Home Wireframe",
		})) {
			const absolutePath = path.join(root, relativePath);
			mkdirSync(path.dirname(absolutePath), { recursive: true });
			writeFileSync(absolutePath, `${content}\n`);
		}

		const result = orchestrateTask(root);
		const contract = readFileSync(
			path.join(root, result?.task.artifacts.contractPath ?? ""),
			"utf8",
		);

		expect(contract).toContain("## Context");
		expect(contract).toContain("docs/design/design-system.md");
		expect(contract).toContain("docs/design/wireframes");
		expect(contract).toContain("## Advisories");
	});
});
