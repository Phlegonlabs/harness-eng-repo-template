import path from "node:path";
import { readFileSync } from "node:fs";
import type {
  DependencyRules,
  FileSizeRules,
  ForbiddenRule,
  ForbiddenRules,
  HarnessConfig,
  NamingRules,
  ValidationContext
} from "./types";
import {
  check,
  exists,
  globToRegex,
  hasPlaceholderContent,
  isTextFile,
  lastCommitUnix,
  lineCount,
  markdownLinks,
  readJson,
  repoRelative,
  trackedFiles
} from "./shared";

export function validationContext(root: string): ValidationContext {
  return {
    repoRoot: root,
    config: readJson<HarnessConfig>(path.join(root, "harness/config.json")),
    dependencyRules: readJson<DependencyRules>(path.join(root, "harness/rules/dependency-layers.json")),
    fileSizeRules: readJson<FileSizeRules>(path.join(root, "harness/rules/file-size-limits.json")),
    namingRules: readJson<NamingRules>(path.join(root, "harness/rules/naming-conventions.json")),
    forbiddenRules: readJson<ForbiddenRules>(path.join(root, "harness/rules/forbidden-patterns.json"))
  };
}

export function getLayerForPath(relativePath: string, rules: DependencyRules) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
  return rules.layers.find((layer) =>
    layer.directories.some((directory) => normalized === directory || normalized.startsWith(`${directory}/`))
  );
}

function resolveImportTarget(importPath: string, fileRelativePath: string, root: string, rules: DependencyRules): string | null {
  const normalizedImport = importPath.replace(/\\/g, "/");
  if (/^\.\.?\//.test(normalizedImport)) {
    const parent = path.dirname(path.join(root, fileRelativePath));
    return repoRelative(root, path.resolve(parent, normalizedImport));
  }
  for (const [alias, target] of Object.entries(rules.internal_import_aliases)) {
    if (normalizedImport === alias || normalizedImport.startsWith(`${alias}/`)) {
      return `${target}/${normalizedImport.slice(alias.length).replace(/^\/+/, "")}`.replace(/\/$/, "");
    }
  }
  if (rules.internal_import_roots.some((prefix) => normalizedImport === prefix || normalizedImport.startsWith(`${prefix}/`))) {
    return normalizedImport;
  }
  return null;
}

function importPathsFromFile(target: string): string[] {
  const content = readFileSync(target, "utf8");
  const matches = [
    ...content.matchAll(/from\s+['"]([^'"]+)['"]/g),
    ...content.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g),
    ...content.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)
  ];
  return [...new Set(matches.map((match) => match[1]))];
}

export function runLayerLint(context: ValidationContext): number {
  let errors = 0;
  const files = trackedFiles(context.repoRoot).filter((file) => /^(src|pkg|cmd)\//.test(file));
  if (files.length === 0) {
    check("INFO", "No source files found for layer lint.");
    return 0;
  }
  for (const relativePath of files) {
    const layer = getLayerForPath(relativePath, context.dependencyRules);
    if (!layer) continue;
    for (const importPath of importPathsFromFile(path.join(context.repoRoot, relativePath))) {
      const resolved = resolveImportTarget(importPath, relativePath, context.repoRoot, context.dependencyRules);
      if (!resolved) continue;
      const targetLayer = getLayerForPath(resolved, context.dependencyRules);
      if (!targetLayer) continue;
      if (targetLayer.index > layer.index) {
        errors += 1;
        console.log(`LAYER VIOLATION: ${relativePath}`);
        console.log(`  File layer: ${layer.name} (index: ${layer.index})`);
        console.log(`  Imports from: ${importPath} (resolved: ${resolved}, layer: ${targetLayer.name})`);
        console.log(`  Allowed imports: ${layer.allowed_imports.join(", ")}`);
        console.log("");
      }
    }
  }
  console.log(errors > 0 ? `FAIL: ${errors} layer boundary violation(s) found.` : "PASS: No layer boundary violations.");
  return errors > 0 ? 1 : 0;
}

export function runFileSizeLint(context: ValidationContext): number {
  let errors = 0;
  for (const relativePath of trackedFiles(context.repoRoot)) {
    if (context.fileSizeRules.excluded_patterns.some((pattern) => globToRegex(pattern).test(relativePath))) continue;
    const absolutePath = path.join(context.repoRoot, relativePath);
    if (!isTextFile(absolutePath)) continue;
    let limit = context.fileSizeRules.default_limit;
    let reason = "Files should be focused and composable.";
    for (const rule of context.fileSizeRules.rules) {
      if (globToRegex(rule.pattern).test(relativePath)) {
        limit = rule.limit;
        reason = rule.reason;
        break;
      }
    }
    const lines = lineCount(absolutePath);
    if (lines > limit) {
      errors += 1;
      console.log(`FILE TOO LARGE: ${relativePath}`);
      console.log(`  Lines: ${lines} (limit: ${limit})`);
      console.log(`  Reason: ${reason}`);
      console.log("");
    }
  }
  console.log(errors > 0 ? `FAIL: ${errors} file(s) exceed size limits.` : "PASS: All files within size limits.");
  return errors > 0 ? 1 : 0;
}

export function runNamingLint(context: ValidationContext): number {
  let errors = 0;
  for (const relativePath of trackedFiles(context.repoRoot)) {
    if (context.namingRules.excluded_patterns.some((pattern) => globToRegex(pattern).test(relativePath))) continue;
    const rule = context.namingRules.rules.find((entry) => globToRegex(entry.path_pattern).test(relativePath));
    if (!rule) continue;
    const fileName = path.basename(relativePath, path.extname(relativePath));
    if (!new RegExp(context.namingRules.case_patterns["kebab-case"]).test(fileName)) {
      errors += 1;
      console.log(`NAMING VIOLATION: ${relativePath}`);
      console.log("  Expected kebab-case filename.");
      console.log(`  Message: ${rule.violation_message}`);
      console.log("");
    }
  }
  console.log(errors > 0 ? `FAIL: ${errors} naming convention violation(s) found.` : "PASS: All file names follow naming conventions.");
  return errors > 0 ? 1 : 0;
}

function ruleTargets(root: string, rule: ForbiddenRule): string[] {
  return trackedFiles(root).filter((relativePath) => {
    const matchesApply = rule.apply_to.some((pattern) => globToRegex(pattern).test(relativePath));
    if (!matchesApply) return false;
    return !(rule.exclude ?? []).some((pattern) => globToRegex(pattern).test(relativePath));
  });
}

function buildRuleRegex(pattern: string): RegExp {
  let flags = "gm";
  let source = pattern;
  if (source.startsWith("(?i)")) {
    source = source.slice(4);
    flags += "i";
  }
  return new RegExp(source, flags);
}

export function runForbiddenLint(context: ValidationContext): number {
  let errors = 0;
  for (const rule of context.forbiddenRules.rules) {
    const regex = buildRuleRegex(rule.pattern);
    for (const relativePath of ruleTargets(context.repoRoot, rule)) {
      const absolutePath = path.join(context.repoRoot, relativePath);
      const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (regex.test(line)) {
          errors += 1;
          console.log(`FORBIDDEN PATTERN [${rule.id}]: ${relativePath}:${index + 1}`);
          console.log(`  Violation: ${rule.description}`);
          console.log(`  Fix: ${rule.message}`);
          console.log("");
        }
        regex.lastIndex = 0;
      });
    }
  }
  console.log(errors > 0 ? `FAIL: ${errors} forbidden pattern(s) found.` : "PASS: No forbidden patterns found.");
  return errors > 0 ? 1 : 0;
}

export function runDocsFreshnessLint(context: ValidationContext): number {
  let warnings = 0;
  const threshold = context.config.validation.doc_freshness_days;
  const now = Math.floor(Date.now() / 1000);
  for (const relativePath of ["docs/product.md", "docs/architecture.md", "docs/progress.md", "docs/internal/agent-entry.md", "AGENTS.md", "CLAUDE.md"]) {
    const committed = lastCommitUnix(context.repoRoot, relativePath);
    if (!committed) continue;
    const daysSince = Math.floor((now - committed) / 86400);
    if (daysSince > threshold) {
      warnings += 1;
      console.log(`STALE DOC: ${relativePath}`);
      console.log(`  Last updated: ${daysSince} day(s) ago`);
      console.log(`  Threshold: ${threshold} day(s)`);
      console.log("");
    }
  }
  console.log(warnings > 0 ? `WARN: ${warnings} doc(s) may be stale.` : `PASS: All key docs updated within ${threshold} day(s).`);
  return 0;
}

export function runRequiredFilesTest(context: ValidationContext): number {
  let errors = 0;
  for (const relativePath of context.config.required_files) {
    if (exists(path.join(context.repoRoot, relativePath))) {
      check("PASS", relativePath);
    } else {
      check("FAIL", `Missing required file: ${relativePath}`);
      errors += 1;
    }
  }
  console.log(errors > 0 ? `FAIL: ${errors} required file(s) missing.` : "PASS: All required files present.");
  return errors > 0 ? 1 : 0;
}

export function runArchitectureTest(context: ValidationContext): number {
  let errors = 0;
  if (!exists(path.join(context.repoRoot, "docs/internal/orchestrator-workflow.md"))) {
    check("FAIL", "Missing orchestrator workflow doc.");
    errors += 1;
  }
  if (!hasPlaceholderContent(path.join(context.repoRoot, "docs/architecture.md")) &&
      !readFileSync(path.join(context.repoRoot, "docs/architecture.md"), "utf8").includes("Dependency Layer Model")) {
    check("FAIL", "Architecture doc does not describe the dependency layer model.");
    errors += 1;
  }
  if (!exists(path.join(context.repoRoot, "docs/progress.md"))) {
    check("FAIL", "Missing docs/progress.md.");
    errors += 1;
  }
  errors += runLayerLint(context);
  console.log(errors > 0 ? `FAIL: ${errors} architectural compliance check(s) failed.` : "PASS: Architecture compliance checks passed.");
  return errors > 0 ? 1 : 0;
}

export function runDocLinksTest(context: ValidationContext): number {
  let errors = 0;
  for (const relativePath of trackedFiles(context.repoRoot).filter((file) => file.endsWith(".md"))) {
    const absolutePath = path.join(context.repoRoot, relativePath);
    const directory = path.dirname(absolutePath);
    for (const link of markdownLinks(absolutePath)) {
      if (/^https?:\/\//.test(link) || link.startsWith("#")) continue;
      const linkPath = link.split("#")[0];
      if (!linkPath) continue;
      const resolved = linkPath.startsWith("/")
        ? path.join(context.repoRoot, linkPath.slice(1))
        : path.resolve(directory, linkPath);
      if (!exists(resolved)) {
        errors += 1;
        console.log(`BROKEN LINK: ${relativePath}`);
        console.log(`  Link: ${link}`);
        console.log("");
      }
    }
  }
  console.log(errors > 0 ? `FAIL: ${errors} broken internal link(s) found.` : "PASS: All internal document links resolve correctly.");
  return errors > 0 ? 1 : 0;
}

export function runDriftScan(context: ValidationContext): number {
  let warnings = 0;
  for (const [relativePath, token] of [
    ["AGENTS.md", "agent-entry.md"],
    ["CLAUDE.md", "agent-entry.md"],
    ["AGENTS.md", "orchestrator-workflow.md"],
    ["CLAUDE.md", "orchestrator-workflow.md"]
  ] as const) {
    if (!readFileSync(path.join(context.repoRoot, relativePath), "utf8").includes(token)) {
      warnings += 1;
      console.log(`DRIFT: ${relativePath} is missing reference ${token}.`);
    }
  }
  console.log(warnings > 0 ? `WARN: ${warnings} drift warning(s).` : "PASS: No drift detected.");
  return 0;
}

export function runOrphanScan(context: ValidationContext): number {
  let warnings = 0;
  const docs = trackedFiles(context.repoRoot).filter((file) => /^docs\/.+\.md$/.test(file) && !file.startsWith("docs/templates/"));
  const markdown = trackedFiles(context.repoRoot).filter((file) => file.endsWith(".md"));
  for (const relativePath of docs) {
    const basename = path.basename(relativePath);
    const referenced = markdown.some((candidate) => {
      if (candidate === relativePath) return false;
      const content = readFileSync(path.join(context.repoRoot, candidate), "utf8");
      return content.includes(relativePath) || content.includes(basename);
    });
    if (!referenced) {
      warnings += 1;
      console.log(`ORPHAN: ${relativePath}`);
    }
  }
  console.log(warnings > 0 ? `WARN: ${warnings} orphan(s) detected.` : "PASS: No orphans detected.");
  return 0;
}

export function runConsistencyScan(context: ValidationContext): number {
  let warnings = 0;
  const expected = /feat.*fix.*docs.*refactor.*test.*chore.*harness/s;
  for (const relativePath of ["docs/internal/agent-entry.md", "AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md"]) {
    if (!expected.test(readFileSync(path.join(context.repoRoot, relativePath), "utf8"))) {
      warnings += 1;
      console.log(`INCONSISTENT: ${relativePath} does not list the canonical commit types.`);
    }
  }
  console.log(warnings > 0 ? `WARN: ${warnings} consistency issue(s) found.` : "PASS: No consistency issues found.");
  return 0;
}
