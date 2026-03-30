export interface SkillMetadata {
	filePatterns?: string[];
	exitCriteria?: string[];
	guardrails?: string[];
}

export interface ResolvedSkillCommand {
	command: string;
	skills: string[];
}

export interface ResolvedSkillSelection {
	loaded: string[];
	reasons: Record<string, string[]>;
	guardrails: string[];
	exitCriteria: ResolvedSkillCommand[];
}

export interface SkillRegistry {
	strategy: string;
	phases: Record<string, string[]>;
	taskKinds: Record<string, string[]>;
	conditions?: Array<{
		when: string;
		load: string[];
	}>;
	routing?: {
		maxLoadedSkills?: number;
		preserveRequiredSkills?: boolean;
		weights?: Record<string, number>;
		reasonLabels?: Record<string, string>;
	};
	skillMetadata?: Record<string, SkillMetadata>;
	validation?: {
		defaultChecksByKind?: Record<string, string[]>;
	};
}
