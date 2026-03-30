import { resolveObservabilityProfile } from "./observability";
import { repoRoot } from "./shared";

async function main(): Promise<void> {
	const root = repoRoot();
	const resolved = resolveObservabilityProfile(root);
	if (resolved.error || !resolved.profile?.healthEndpoint) {
		console.log("harness health");
		console.log("════════════════════════════════════════════");
		console.log(
			`BLOCKED: ${resolved.error ?? "Active profile has no health endpoint."}`,
		);
		process.exit(1);
	}

	const timeoutMs = resolved.profile.healthTimeoutMs ?? 5000;
	const signal = AbortSignal.timeout(timeoutMs);
	const response = await fetch(resolved.profile.healthEndpoint, { signal });
	const body = await response.text();

	console.log("harness health");
	console.log("════════════════════════════════════════════");
	console.log(`Profile: ${resolved.profile.name}`);
	console.log(`Endpoint: ${resolved.profile.healthEndpoint}`);
	console.log(`Status: ${response.status}`);
	if (body) {
		console.log(`Body: ${body.slice(0, 400)}`);
	}
	process.exit(response.ok ? 0 : 1);
}

void main();
