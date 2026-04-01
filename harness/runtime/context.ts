import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
} from "node:fs";
import path from "node:path";
import {
	hasPlaceholderContent,
	repoRelative,
	writeJson,
	writeTextFile,
} from "./shared";
import type {
	ContextManifest,
	ContextManifestEntry,
	ContextReference,
	TaskContextSummary,
	TaskRecord,
} from "./types";

export const CANONICAL_CONTEXT_PATHS = {
	product: "docs/product.md",
	architecture: "docs/architecture.md",
	designIndex: "docs/design/overview.md",
	designSystem: "docs/design/design-system.md",
	components: "docs/design/components.md",
	wireframesDir: "docs/design/wireframes",
	wireframesIndex: "docs/design/wireframes/index.md",
	manifest: ".harness/context/context-manifest.json",
} as const;

interface ContextSyncOptions {
	product?: string;
	architecture?: string;
	designSystem?: string;
	components?: string;
	wireframes?: string;
}

export interface ContextSyncResult {
	manifest: ContextManifest;
	updated: ContextManifestEntry[];
}

function absolute(root: string, relativePath: string): string {
	return path.join(root, relativePath);
}

function normalize(value: string): string {
	return value.replace(/\\/g, "/");
}

function isReadyMarkdown(root: string, relativePath: string): boolean {
	const target = absolute(root, relativePath);
	if (!existsSync(target)) {
		return false;
	}
	if (hasPlaceholderContent(target)) {
		return false;
	}
	return readFileSync(target, "utf8").trim().length > 0;
}

function isFrontendArea(area: string): boolean {
	const normalized = normalize(area);
	return (
		normalized === "apps/web" ||
		normalized.startsWith("apps/web/") ||
		normalized === "src/ui" ||
		normalized.startsWith("src/ui/") ||
		normalized.includes("/src/ui/")
	);
}

export function isFrontendTask(task: TaskRecord): boolean {
	if (task.affectedFilesOrAreas.some(isFrontendArea)) {
		return true;
	}
	return /\b(frontend|ui|ux|screen|page|component|wireframe|visual)\b/i.test(
		task.title,
	);
}

function wireframeAssetPaths(root: string): string[] {
	const dir = absolute(root, CANONICAL_CONTEXT_PATHS.wireframesDir);
	if (!existsSync(dir)) {
		return [];
	}
	const assets: string[] = [];
	const visit = (current: string) => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			if (entry.name.startsWith(".")) {
				continue;
			}
			const fullPath = path.join(current, entry.name);
			if (entry.isDirectory()) {
				visit(fullPath);
				continue;
			}
			const relative = repoRelative(root, fullPath);
			if (normalize(relative) === CANONICAL_CONTEXT_PATHS.wireframesIndex) {
				continue;
			}
			assets.push(relative);
		}
	};
	visit(dir);
	return assets.sort((left, right) => left.localeCompare(right));
}

function maybeRef(
	root: string,
	relativePath: string,
	label: string,
	kind: string,
	required: boolean,
): ContextReference | null {
	if (!existsSync(absolute(root, relativePath))) {
		return null;
	}
	return {
		kind,
		label,
		path: relativePath,
		required,
	};
}

export function readContextManifest(root: string): ContextManifest {
	const manifestPath = absolute(root, CANONICAL_CONTEXT_PATHS.manifest);
	if (!existsSync(manifestPath)) {
		return {
			version: "1.0.0",
			syncedAt: null,
			entries: [],
		};
	}
	return JSON.parse(readFileSync(manifestPath, "utf8")) as ContextManifest;
}

function writeContextManifest(root: string, manifest: ContextManifest): void {
	writeJson(absolute(root, CANONICAL_CONTEXT_PATHS.manifest), manifest);
}

function replaceTextDocument(
	root: string,
	sourcePath: string,
	targetRelativePath: string,
): void {
	const source = path.resolve(root, sourcePath);
	if (!existsSync(source) || statSync(source).isDirectory()) {
		throw new Error(`Context source must be a file: ${sourcePath}`);
	}
	writeTextFile(
		absolute(root, targetRelativePath),
		readFileSync(source, "utf8"),
	);
}

function ensureWireframeDirectory(root: string): string {
	const dir = absolute(root, CANONICAL_CONTEXT_PATHS.wireframesDir);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function copyDirectoryContents(
	source: string,
	target: string,
	sourceRoot: string = source,
): void {
	for (const entry of readdirSync(source, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) {
			continue;
		}
		const sourcePath = path.join(source, entry.name);
		const targetPath = path.join(target, entry.name);
		if (entry.isDirectory()) {
			mkdirSync(targetPath, { recursive: true });
			copyDirectoryContents(sourcePath, targetPath, sourceRoot);
			continue;
		}
		if (path.relative(sourceRoot, sourcePath) === "README.md") {
			continue;
		}
		mkdirSync(path.dirname(targetPath), { recursive: true });
		copyFileSync(sourcePath, targetPath);
	}
}

function renderWireframesIndex(root: string): string {
	const assets = wireframeAssetPaths(root);
	if (assets.length === 0) {
		return [
			"# Wireframes",
			"",
			"Use this directory for layout references, low-fidelity sketches, annotated screenshots, and supporting notes.",
			"",
			"- Drop images, PDFs, or markdown notes here directly.",
			"- Or sync them in with `bun run harness:context:sync --wireframes <path>`.",
			"",
			"## Current Assets",
			"",
			"- [Describe the current wireframe source or sync assets into this directory.]",
			"",
		].join("\n");
	}
	return [
		"# Wireframes",
		"",
		"Canonical index for synced wireframe and layout-reference assets.",
		"",
		"## Current Assets",
		"",
		...assets.map((asset) => `- \`${asset}\``),
		"",
	].join("\n");
}

function mergeWireframes(root: string, sourcePath: string): void {
	const source = path.resolve(root, sourcePath);
	if (!existsSync(source)) {
		throw new Error(`Wireframe source does not exist: ${sourcePath}`);
	}
	const targetDir = ensureWireframeDirectory(root);
	if (statSync(source).isDirectory()) {
		copyDirectoryContents(source, targetDir);
	} else {
		const targetPath = path.join(targetDir, path.basename(source));
		copyFileSync(source, targetPath);
	}
	writeTextFile(
		absolute(root, CANONICAL_CONTEXT_PATHS.wireframesIndex),
		`${renderWireframesIndex(root)}\n`,
	);
}

function upsertEntries(
	existing: ContextManifestEntry[],
	incoming: ContextManifestEntry[],
): ContextManifestEntry[] {
	const byKey = new Map<string, ContextManifestEntry>();
	for (const entry of existing) {
		byKey.set(`${entry.kind}:${entry.target}`, entry);
	}
	for (const entry of incoming) {
		byKey.set(`${entry.kind}:${entry.target}`, entry);
	}
	return [...byKey.values()].sort((left, right) =>
		`${left.kind}:${left.target}`.localeCompare(
			`${right.kind}:${right.target}`,
		),
	);
}

export function syncContextSources(
	root: string,
	options: ContextSyncOptions,
): ContextSyncResult {
	const now = new Date().toISOString();
	const updated: ContextManifestEntry[] = [];
	const syncDoc = (
		kind: string,
		sourcePath: string | undefined,
		targetRelativePath: string,
	) => {
		if (!sourcePath) {
			return;
		}
		replaceTextDocument(root, sourcePath, targetRelativePath);
		updated.push({
			kind,
			source: path.resolve(root, sourcePath),
			target: targetRelativePath,
			mode: "replace",
			isDirectory: false,
			syncedAt: now,
		});
	};

	syncDoc("product", options.product, CANONICAL_CONTEXT_PATHS.product);
	syncDoc(
		"architecture",
		options.architecture,
		CANONICAL_CONTEXT_PATHS.architecture,
	);
	syncDoc(
		"design-system",
		options.designSystem,
		CANONICAL_CONTEXT_PATHS.designSystem,
	);
	syncDoc("components", options.components, CANONICAL_CONTEXT_PATHS.components);

	if (options.wireframes) {
		mergeWireframes(root, options.wireframes);
		const source = path.resolve(root, options.wireframes);
		updated.push({
			kind: "wireframes",
			source,
			target: CANONICAL_CONTEXT_PATHS.wireframesDir,
			mode: "merge",
			isDirectory: statSync(source).isDirectory(),
			syncedAt: now,
		});
	}

	const existing = readContextManifest(root);
	const manifest: ContextManifest = {
		version: "1.0.0",
		syncedAt: updated.length > 0 ? now : existing.syncedAt,
		entries: upsertEntries(existing.entries, updated),
	};
	writeContextManifest(root, manifest);
	return { manifest, updated };
}

export function describeAvailableContext(
	root: string,
	task: TaskRecord,
): TaskContextSummary {
	const refs: ContextReference[] = [];
	const advisories: string[] = [];

	const productRef = maybeRef(
		root,
		CANONICAL_CONTEXT_PATHS.product,
		"Product requirements",
		"product",
		true,
	);
	const architectureRef = maybeRef(
		root,
		CANONICAL_CONTEXT_PATHS.architecture,
		"Architecture",
		"architecture",
		true,
	);
	if (productRef) {
		refs.push(productRef);
	}
	if (architectureRef) {
		refs.push(architectureRef);
	}

	if (!isFrontendTask(task)) {
		return { refs, advisories };
	}

	const designIndexRef = maybeRef(
		root,
		CANONICAL_CONTEXT_PATHS.designIndex,
		"Design context overview",
		"design-overview",
		false,
	);
	if (designIndexRef) {
		refs.push(designIndexRef);
	}

	if (isReadyMarkdown(root, CANONICAL_CONTEXT_PATHS.designSystem)) {
		const ref = maybeRef(
			root,
			CANONICAL_CONTEXT_PATHS.designSystem,
			"Design system",
			"design-system",
			false,
		);
		if (ref) {
			refs.push(ref);
		}
	} else {
		advisories.push(
			"Frontend task detected, but docs/design/design-system.md is missing or still contains template placeholders.",
		);
	}

	if (isReadyMarkdown(root, CANONICAL_CONTEXT_PATHS.components)) {
		const ref = maybeRef(
			root,
			CANONICAL_CONTEXT_PATHS.components,
			"Component guidelines",
			"components",
			false,
		);
		if (ref) {
			refs.push(ref);
		}
	} else {
		advisories.push(
			"Frontend task detected, but docs/design/components.md is missing or still contains template placeholders.",
		);
	}

	if (existsSync(absolute(root, CANONICAL_CONTEXT_PATHS.wireframesIndex))) {
		const ref = maybeRef(
			root,
			CANONICAL_CONTEXT_PATHS.wireframesIndex,
			"Wireframe index",
			"wireframes-index",
			false,
		);
		if (ref) {
			refs.push(ref);
		}
	}

	const wireframes = wireframeAssetPaths(root);
	if (wireframes.length > 0) {
		refs.push({
			kind: "wireframes-assets",
			label: "Wireframe assets",
			path: CANONICAL_CONTEXT_PATHS.wireframesDir,
			required: false,
		});
	} else {
		advisories.push(
			"Frontend task detected, but docs/design/wireframes/ does not contain any synced assets yet.",
		);
	}

	return { refs, advisories };
}

export function resetWireframeAssets(root: string): void {
	const dir = absolute(root, CANONICAL_CONTEXT_PATHS.wireframesDir);
	if (!existsSync(dir)) {
		return;
	}
	for (const asset of wireframeAssetPaths(root)) {
		rmSync(absolute(root, asset), { force: true });
	}
	writeTextFile(
		absolute(root, CANONICAL_CONTEXT_PATHS.wireframesIndex),
		`${renderWireframesIndex(root)}\n`,
	);
}
