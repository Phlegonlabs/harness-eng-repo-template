import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { stateTemplate, saveState } from "./planning";
import { readJson, repoRoot, runPassthrough, writeJson } from "./shared";

const root = repoRoot();
const projectName = process.argv.at(-1);
if (!projectName || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(projectName)) {
  console.error("Usage: bun run harness:bootstrap -- <kebab-case-project-name>");
  process.exit(1);
}

const configPath = path.join(root, "harness/config.json");
const config = readJson<Record<string, unknown>>(configPath);
config.project_name = projectName;
writeJson(configPath, config);
saveState(root, stateTemplate(projectName));

writeFileSync(path.join(root, ".env.example"), readFileSync(path.join(root, ".env.example"), "utf8").replaceAll("harness-template", projectName));
const title = projectName.split("-").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
writeFileSync(path.join(root, "README.md"), readFileSync(path.join(root, "README.md"), "utf8").replace(/^# .+$/m, `# ${title}`));
writeFileSync(path.join(root, "LICENSE"), readFileSync(path.join(root, "LICENSE"), "utf8")
  .replaceAll("Harness Engineering Template Contributors", `${projectName} contributors`)
  .replaceAll("2026", `${new Date().getFullYear()}`));

if (runPassthrough("git", ["-C", root, "rev-parse", "--git-dir"], root) !== 0) {
  runPassthrough("git", ["-C", root, "init"], root);
}
runPassthrough("bun", ["run", "harness:install-hooks"], root);
runPassthrough("bun", ["run", "harness:doctor"], root);
