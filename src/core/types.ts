export enum FSMState {
  INIT = 'INIT',
  VALIDATE_GOAL = 'VALIDATE_GOAL',
  LAUNCH_BROWSER = 'LAUNCH_BROWSER',
  NAVIGATE = 'NAVIGATE',
  OBSERVE = 'OBSERVE',
  PLAN = 'PLAN',
  ACT = 'ACT',
  VALIDATE = 'VALIDATE',
  RECOVER = 'RECOVER',
  COMPLETE = 'COMPLETE',
  TEARDOWN = 'TEARDOWN',
  FAILED = 'FAILED',
}

export const VALID_TRANSITIONS: Record<FSMState, FSMState[]> = {
  [FSMState.INIT]:          [FSMState.VALIDATE_GOAL, FSMState.FAILED],
  [FSMState.VALIDATE_GOAL]: [FSMState.LAUNCH_BROWSER, FSMState.FAILED],
  [FSMState.LAUNCH_BROWSER]:[FSMState.NAVIGATE, FSMState.FAILED],
  [FSMState.NAVIGATE]:      [FSMState.OBSERVE, FSMState.RECOVER, FSMState.FAILED],
  [FSMState.OBSERVE]:       [FSMState.PLAN, FSMState.RECOVER, FSMState.FAILED],
  [FSMState.PLAN]:          [FSMState.ACT, FSMState.RECOVER, FSMState.FAILED],
  [FSMState.ACT]:           [FSMState.VALIDATE, FSMState.RECOVER, FSMState.FAILED],
  [FSMState.VALIDATE]:      [FSMState.OBSERVE, FSMState.COMPLETE, FSMState.RECOVER],
  [FSMState.RECOVER]:       [FSMState.OBSERVE, FSMState.FAILED],
  [FSMState.COMPLETE]:      [FSMState.TEARDOWN],
  [FSMState.TEARDOWN]:      [],
  [FSMState.FAILED]:        [FSMState.TEARDOWN],
};

export interface SubObjective {
  id: string;
  label: string;
  targetFieldDescription: string;
  expectedValue: string;
  completionCondition: {
    fieldLabel: string;
    expectedValue: string;
  };
}

export interface Goal {
  label: string;
  targetUrl: string;
  subObjectives: SubObjective[];
}

export interface ActionOutcomeRecord {
  subObjectiveId: string;
  targetSelector: string;
  expectedValue?: string;
  actualValue?: string;
  status: 'COMPLETE' | 'FAILED' | 'PENDING';
}

export interface ExecutionResult {
  status: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  steps: number;
  durationMs: number;
  executionTrace?: string;
  subObjectiveResults?: Record<string, { status: string }>;
  hardcodedSelectorsUsed?: number;
  recoveryCount?: number;
}
