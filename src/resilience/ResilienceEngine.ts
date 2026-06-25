import { ToolError } from '../tools/types';
import { Decision } from '../reasoning/types';
import { Action } from '../tools/types';

export interface RecoveryContext {
  decision: Decision;
  lastError?: ToolError;
}

export interface RecoveryResult {
  success: boolean;
  recoveredAction?: Action;
  recoveryStrategy?: string;
}

export class ResilienceEngine {

  async handleInsufficient(decision: Decision): Promise<RecoveryResult> {
    // Stub: Implement recovery strategy here
    return { success: false };
  }

  async handle(error: ToolError, subGoalId: string = 'global', failedAttemptsCount: number = 0, originalAction?: Action): Promise<RecoveryResult> {
    if (error.code?.includes('FATAL') || error.message?.includes('FATAL')) {
      throw new Error(`Fatal error: ${error.message}`);
    }

    if (error.code === 'ELEMENT_NOT_FOUND') {
      if (failedAttemptsCount === 0) return { success: true, recoveredAction: { name: 'scroll', params: { direction: 'down', amount_px: 400 } }, recoveryStrategy: 'scroll_down' };
      if (failedAttemptsCount === 1) return { success: true, recoveredAction: { name: 'scroll', params: { direction: 'up', amount_px: 400 } }, recoveryStrategy: 'scroll_up' };
      // Fallback
    }

    if (error.code === 'CLICK_FAILED') {
      if (failedAttemptsCount === 0 && originalAction?.params?.elementId) return { success: true, recoveredAction: { name: 'press_key', params: { key: 'Enter' } }, recoveryStrategy: 'press_enter' };
      if (failedAttemptsCount === 1 && originalAction?.params?.elementId) return { success: true, recoveredAction: { name: 'scroll', params: { direction: 'down', amount_px: 200 } }, recoveryStrategy: 'scroll_down' };
    }

    if (error.code === 'SEND_KEYS_FAILED' || error.code === 'TYPE_FAILED') {
      // TransitionEngine now handles pre-execution focus/click requirements.
      // If a type fails here, it's an actual execution failure (e.g. element obscured/detached).
      if (failedAttemptsCount === 0) return { success: true, recoveredAction: { name: 'wait', params: { ms: 500 } }, recoveryStrategy: 'wait_and_retry' };
      if (failedAttemptsCount === 1 && originalAction?.params?.elementId) return { success: true, recoveredAction: { name: 'press_key', params: { key: 'Escape' } }, recoveryStrategy: 'press_escape' };
    }

    if (error.code === 'NAVIGATION_FAILED') {
      if (failedAttemptsCount === 0) return { success: true, recoveredAction: { name: 'go_back', params: {} }, recoveryStrategy: 'go_back' };
      if (failedAttemptsCount === 1) return { success: true, recoveredAction: { name: 'navigate', params: { url: originalAction?.params?.url } }, recoveryStrategy: 'retry_navigate' };
    }

    if (error.code === 'VERIFICATION_FAILED') {
      // Escalation Hierarchy:
      // 0: Retry the exact same action (maybe it just needed a moment)
      if (failedAttemptsCount === 0) {
        return { success: true, recoveredAction: originalAction, recoveryStrategy: 'retry_same_action' };
      }
      // 1: Wait and reobserve before deciding
      if (failedAttemptsCount === 1) {
        return { success: true, recoveredAction: { name: 'wait', params: {} }, recoveryStrategy: 'wait_and_reobserve' };
      }
      // 2: Force it back to planner without a recovered action
      if (failedAttemptsCount === 2) {
        return { success: true, recoveryStrategy: 'delegate_to_planner' };
      }
      // >2: Exhausted
      return { success: false, recoveryStrategy: 'exhausted' };
    }

    // Recoverable errors will transition FSM to RECOVER and attempt next action.
    return { success: false };
  }
}
