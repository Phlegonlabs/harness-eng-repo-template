import { readFileSync } from "node:fs";
import path from "node:path";
import { writeCommandSurfaceDoc } from "./command-surface";
import { saveState, stateTemplate } from "./planning";
import {
	readJson,
	repoRoot,
	runPassthrough,
	writeJson,
	writeTextFile,
} from "./shared";
import {
	renderBaselineArchitectureDoc,
	renderBaselineProductDoc,
	renderQualityGradesDoc,
	renderReadyProgressDoc,
} from "./template-baseline";
import type { DependencyRules } from "./types";

const root = repoRoot();
const args = process.argv.slice(2);
let profileName = "fullstack";
let ownerArg: string | null = null;
let projectName: string | null = null;

for (let index = 0; index < args.length; index += 1) {
	const arg = args[index];
	if (arg === "--profile") {
		profileName = args[index + 1] ?? "";
		index += 1;
		continue;
	}
	if (arg === "--owner") {
		ownerArg = args[index + 1] ?? "";
		index += 1;
		continue;
	}
	if (!arg.startsWith("--") && !projectName) {
		projectName = arg;
	}
}

if (!projectName || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(projectName)) {
	console.error(
		"Usage: bun run harness:init -- <kebab-case-project-name> [--profile fullstack|api|cli|library] [--owner @org/team-or-user]",
	);
	process.exit(1);
}
if (ownerArg && !/^@[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)?$/.test(ownerArg)) {
	console.error(
		"Invalid --owner value. Use a GitHub handle or team slug such as @acme/engineering.",
	);
	process.exit(1);
}
const targetProjectName = projectName;

const configPath = path.join(root, "harness/config.json");
const config = readJson<Record<string, unknown>>(configPath);
const profilePath = path.join(root, "harness/profiles", `${profileName}.json`);
const profile = (() => {
	try {
		return readJson<{ layers: string[] }>(profilePath);
	} catch {
		console.error(
			`Unknown profile '${profileName}'. Available profiles: fullstack, api, cli, library.`,
		);
		process.exit(1);
	}
})();
const previousProjectName =
	typeof config.project_name === "string"
		? config.project_name
		: "harness-template";
const previousProjectOwner =
	typeof config.project_owner === "string" && config.project_owner.trim() !== ""
		? config.project_owner.trim()
		: null;
const projectOwner = ownerArg?.trim() || previousProjectOwner;
config.project_name = targetProjectName;
config.project_owner = projectOwner ?? "";
config.layers = profile.layers;
writeJson(configPath, config);
saveState(root, stateTemplate(targetProjectName));

const dependencyRulesPath = path.join(
	root,
	"harness/rules/dependency-layers.json",
);
const dependencyRules = readJson<DependencyRules & Record<string, unknown>>(
	dependencyRulesPath,
);
dependencyRules.layers = dependencyRules.layers.filter((layer) =>
	profile.layers.includes(layer.name),
);
writeJson(dependencyRulesPath, dependencyRules);

const packageJsonPath = path.join(root, "package.json");
const packageJson = readJson<Record<string, unknown>>(packageJsonPath);
packageJson.name = targetProjectName;
writeJson(packageJsonPath, packageJson);

const templateScope = "@harness-template";
const previousScope = `@${previousProjectName}`;
const projectScope = `@${targetProjectName}`;

function rewriteIdentitySurface(relativePath: string): void {
	const absolutePath = path.join(root, relativePath);
	const current = readFileSync(absolutePath, "utf8");
	let next = current
		.replaceAll(previousScope, projectScope)
		.replaceAll(templateScope, projectScope)
		.replaceAll(previousProjectName, targetProjectName);
	if (projectOwner) {
		next = next.replaceAll("@your-org/engineering", projectOwner);
		if (previousProjectOwner) {
			next = next.replaceAll(previousProjectOwner, projectOwner);
		}
	}
	if (next !== current) {
		writeTextFile(absolutePath, next);
	}
}

for (const relativePath of [
	"apps/web/package.json",
	"apps/api/package.json",
	"packages/shared/package.json",
]) {
	const absolutePath = path.join(root, relativePath);
	const workspacePackage = readJson<Record<string, unknown>>(absolutePath);
	if (typeof workspacePackage.name === "string") {
		workspacePackage.name = workspacePackage.name
			.replace(previousScope, projectScope)
			.replace(templateScope, projectScope);
	}
	for (const field of [
		"dependencies",
		"devDependencies",
		"peerDependencies",
	] as const) {
		const dependencies = workspacePackage[field];
		if (!dependencies || typeof dependencies !== "object") continue;
		workspacePackage[field] = Object.fromEntries(
			Object.entries(dependencies as Record<string, string>).map(
				([key, value]) => [
					key
						.replace(previousScope, projectScope)
						.replace(templateScope, projectScope),
					value,
				],
			),
		);
	}
	writeJson(absolutePath, workspacePackage);
}

writeTextFile(
	path.join(root, "docs/product.md"),
	`${renderBaselineProductDoc(targetProjectName, { owner: projectOwner ?? undefined })}\n`,
);
writeTextFile(
	path.join(root, "docs/architecture.md"),
	`${renderBaselineArchitectureDoc(targetProjectName, {
		owner: projectOwner ?? undefined,
	})}\n`,
);
writeTextFile(
	path.join(root, "docs/progress.md"),
	`${renderReadyProgressDoc()}\n`,
);
writeTextFile(
	path.join(root, "docs/quality/GRADES.md"),
	`${renderQualityGradesDoc({ owner: projectOwner ?? undefined })}\n`,
);
writeCommandSurfaceDoc(root);

writeTextFile(
	path.join(root, ".env.example"),
	readFileSync(path.join(root, ".env.example"), "utf8").replaceAll(
		previousProjectName,
		targetProjectName,
	),
);
const title = targetProjectName
	.split("-")
	.map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
	.join(" ");
writeTextFile(
	path.join(root, "README.md"),
	readFileSync(path.join(root, "README.md"), "utf8").replace(
		/^# .+$/m,
		`# ${title}`,
	),
);
writeTextFile(
	path.join(root, "LICENSE"),
	readFileSync(path.join(root, "LICENSE"), "utf8")
		.replaceAll(
			"Harness Engineering Template Contributors",
			`${targetProjectName} contributors`,
		)
		.replaceAll(
			`${previousProjectName} contributors`,
			`${targetProjectName} contributors`,
		)
		.replaceAll("2026", `${new Date().getFullYear()}`),
);
for (const relativePath of [
	".github/CODEOWNERS",
	"apps/api/AGENTS.md",
	"apps/web/AGENTS.md",
	"packages/shared/AGENTS.md",
	"docs/internal/observability.md",
	"docs/decisions/005-observability-strategy.md",
	"harness/rules/forbidden-patterns.json",
]) {
	rewriteIdentitySurface(relativePath);
}

if (runPassthrough("git", ["-C", root, "rev-parse", "--git-dir"], root) !== 0) {
	runPassthrough("git", ["-C", root, "init"], root);
}
runPassthrough("bun", ["run", "format"], root);
runPassthrough("bun", ["run", "harness:install-hooks"], root);
runPassthrough("bun", ["run", "harness:doctor"], root);
