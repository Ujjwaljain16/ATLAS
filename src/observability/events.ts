export interface EventCorrelation {
  sessionId?: string;
  executionId?: string;
  stepId?: number;
  actionId?: string;
}

export type ATLASEvent = EventCorrelation & (
  | { type: 'SessionStarted';        goal: string; timestamp: string }
  | { type: 'NavigationComplete';    url: string; loadTimeMs: number; ready: boolean }
  | { type: 'ObservationReady';      observationId: string; elementCount: number }
  | { type: 'WorldModelBuilt';       worldStateId: string; formCount: number; fieldCount: number }
  | { type: 'DecisionMade';          thought: string; action: string; confidence: number; discoveryTier: number; matchedSignal: string }
  | { type: 'ActionExecuted';        tool: string; success: boolean; durationMs: number }
  | { type: 'SubObjectiveComplete';  subObjective: string }
  | { type: 'FailureDetected';       severity: string; source: string; code: string }
  | { type: 'RecoveryAttempted';     strategy: string; attempt: number }
  | { type: 'SelfHealTriggered';     originalId: string }
  | { type: 'SelfHealComplete';      originalId: string; healedId: string; healedTier: number }
  | { type: 'CoordinateFallbackTriggered'; target: string }
  | { 
      type: 'SessionComplete';       
      result: 'SUCCESS'|'FAILURE'|'PARTIAL'; 
      steps: number; 
      durationMs: number;
      metrics: {
        navigationMs: number;
        observationMs: number;
        worldModelMs: number;
        reasoningMs: number;
        actionMs: number;
        validationMs: number;
        teardownMs: number;
      }
    }
);
