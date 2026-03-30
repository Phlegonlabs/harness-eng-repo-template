import path from "node:path";
import { readJson, repoRoot } from "./shared";
import type {
	ObservabilityProfile,
	ObservabilityProfilesConfig,
	ValidationContext,
} from "./types";
import { validationContext } from "./validation";

export function resolveObservabilityProfile(root: string = repoRoot()): {
	context: ValidationContext;
	profile: ObservabilityProfile | null;
	error: string | null;
} {
	const context = validationContext(root);
	if (!context.config.observability?.enabled) {
		return {
			context,
			profile: null,
			error: "Observability is disabled in harness/config.json.",
		};
	}
	const activeProfile = context.config.observability.activeProfile;
	if (!activeProfile) {
		return {
			context,
			profile: null,
			error: "No active observability profile is configured.",
		};
	}
	const profiles =
		context.observabilityProfiles?.profiles ??
		readJson<ObservabilityProfilesConfig>(
			path.join(root, "harness/rules/observability-profiles.json"),
		).profiles;
	const profile =
		profiles.find(
			(entry: ObservabilityProfile) => entry.name === activeProfile,
		) ?? null;
	if (!profile) {
		return {
			context,
			profile: null,
			error: `Observability profile ${activeProfile} is not defined.`,
		};
	}
	return { context, profile, error: null };
}
