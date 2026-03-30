import { mkdirSync } from "node:fs";
import path from "node:path";
import { repoRelative, writeJson } from "./shared";

function ensureReportDir(root: string, dirname: string): string {
	const target = path.join(root, ".harness", dirname);
	mkdirSync(target, { recursive: true });
	return target;
}

export function writeReportArtifact(
	root: string,
	dirname: string,
	fileName: string,
	value: unknown,
): string {
	const target = path.join(ensureReportDir(root, dirname), fileName);
	writeJson(target, value);
	return repoRelative(root, target);
}
