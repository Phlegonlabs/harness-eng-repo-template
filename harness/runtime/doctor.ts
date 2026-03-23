import path from "node:path";
import { readJson, repoRoot, check, writeSection, run, exists } from "./shared";

const root = repoRoot();
let errors = 0;
let warnings = 0;

console.log("harness doctor");
console.log("══════════════════════════════════════════");

writeSection("Tools");
try {
  check("PASS", `bun is available (${run("bun", ["--version"], root)})`);
} catch {
  check("FAIL", "bun is not available.");
  errors += 1;
}

try {
  check("PASS", `git is available (${run("git", ["--version"], root)})`);
} catch {
  check("FAIL", "git is not available.");
  errors += 1;
}

writeSection("Git Repository");
try {
  run("git", ["-C", root, "rev-parse", "--git-dir"], root);
  check("PASS", "Git repository initialized");
} catch {
  check("FAIL", "Not a git repository.");
  errors += 1;
}

writeSection("Harness Files");
for (const relativePath of [
  "package.json",
  "tsconfig.json",
  "harness/config.json",
  "harness/rules/dependency-layers.json",
  "harness/rules/file-size-limits.json",
  "harness/rules/naming-conventions.json",
  "harness/rules/forbidden-patterns.json",
  "harness/skills/registry.json",
  ".harness/state.json"
]) {
  const absolutePath = path.join(root, relativePath);
  if (!exists(absolutePath)) {
    check("FAIL", `${relativePath} is missing`);
    errors += 1;
    continue;
  }
  if (relativePath.endsWith(".json")) {
    readJson(absolutePath);
    check("PASS", `${relativePath} is valid JSON`);
  } else {
    check("PASS", `${relativePath} exists`);
  }
}

writeSection("Planning Surfaces");
for (const relativePath of [
  "AGENTS.md",
  "CLAUDE.md",
  "docs/product.md",
  "docs/architecture.md",
  "docs/progress.md",
  "docs/internal/agent-entry.md",
  "docs/internal/orchestrator-workflow.md"
]) {
  if (exists(path.join(root, relativePath))) {
    check("PASS", `${relativePath} exists`);
  } else {
    check("FAIL", `${relativePath} is missing`);
    errors += 1;
  }
}

writeSection("Git Hooks");
for (const hook of ["pre-commit", "commit-msg", "pre-push"]) {
  if (exists(path.join(root, ".git/hooks", hook))) {
    check("PASS", `Hook installed: ${hook}`);
  } else {
    check("WARN", `Hook not installed: ${hook} — run bun run harness:install-hooks`);
    warnings += 1;
  }
}

writeSection("Bootstrap Status");
const config = readJson<{ project_name: string }>(path.join(root, "harness/config.json"));
if (config.project_name === "harness-template") {
  check("WARN", "Project name is still 'harness-template'. Run bun run harness:bootstrap -- <your-project-name>");
  warnings += 1;
} else {
  check("PASS", `Project name: ${config.project_name}`);
}

console.log("");
console.log("══════════════════════════════════════════");
if (errors > 0) {
  console.log(`FAIL: ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
}
if (warnings > 0) {
  console.log(`PASS with warnings: ${warnings} warning(s)`);
  process.exit(0);
}
console.log("PASS: Harness is healthy.");
