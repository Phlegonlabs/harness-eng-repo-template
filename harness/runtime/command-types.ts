export type CommandScope = "root" | "workspace";
export type WorkspaceKind = "app" | "package";
export type CommandMode = "one_shot" | "persistent";
export type MissingPrereqBehavior = "n/a" | "expected_block";
export type CommandSuccessMode = "exit_zero" | "persistent_boot";

export interface CommandDefinition {
	id: string;
	display: string;
	requires: string[];
	summary: string;
}

export interface NormalizedCommandDefinition extends CommandDefinition {
	scope: CommandScope;
	workspaceKind?: WorkspaceKind;
	mode: CommandMode;
	mutatesRepo: boolean;
	missingPrereqBehavior: MissingPrereqBehavior;
	successMode: CommandSuccessMode;
}

export interface CommandSurfaceRegistry {
	version: string;
	includes: string[];
}

export interface CommandSurfaceFragment {
	commands: CommandDefinition[];
}
