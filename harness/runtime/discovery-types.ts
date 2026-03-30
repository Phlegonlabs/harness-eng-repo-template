export type DiscoveryStage = "PRD" | "ARCHITECTURE" | "COMPLETE";
export type DiscoveryStatus = "idle" | "collecting" | "ready_for_plan";

export interface DiscoveryQuestion {
	id: string;
	stage: Exclude<DiscoveryStage, "COMPLETE">;
	prompt: string;
	docTargets: string[];
	expectedAnswerShape: string;
}

export interface DiscoveryQuestionPacket {
	stage: Exclude<DiscoveryStage, "COMPLETE">;
	questionIds: string[];
	questions: DiscoveryQuestion[];
	completionCriteria: {
		productReady: boolean;
		architectureReady: boolean;
		planReady: boolean;
	};
}

export interface DiscoveryAnswer {
	id: string;
	value: string;
}

export interface DiscoveryAnswerBatch {
	answers: DiscoveryAnswer[];
}

export interface DiscoveryHistoryRecord {
	stage: DiscoveryStage;
	questionIds: string[];
	answeredAt: string;
}

export interface DiscoveryReadiness {
	productReady: boolean;
	architectureReady: boolean;
	planReady: boolean;
}

export interface DiscoveryState {
	stage: DiscoveryStage;
	status: DiscoveryStatus;
	currentQuestionIds: string[];
	answered: Record<string, string>;
	history: DiscoveryHistoryRecord[];
	readiness: DiscoveryReadiness;
	lastUpdatedAt: string | null;
}
