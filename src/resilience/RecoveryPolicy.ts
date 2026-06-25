import { ClassificationResult } from './FailureClassifier';
import { Action } from '../tools/types';
import { ExecutionContext } from '../core/ExecutionContext';

export interface RecoveryAction {
  action: Action;
  strategyName: string;
}

export class RecoveryPolicy {
  determineRecovery(classification: ClassificationResult, context: ExecutionContext, targetId: string): RecoveryAction | null {
    // We check context.recoveryHistory to ensure we don't repeat the same strategy for the same classification
    const pastStrategies = context.recoveryHistory
      .filter(h => h.classification === classification.classification)
      .map(h => h.strategyUsed);

    if (classification.classification === 'COVERED') {
      if (!pastStrategies.includes('scroll_down')) return { action: { name: 'scroll', params: { direction: 'down', amount_px: 300 } }, strategyName: 'scroll_down' };
      if (!pastStrategies.includes('scroll_up')) return { action: { name: 'scroll', params: { direction: 'up', amount_px: 600 } }, strategyName: 'scroll_up' };
      if (!pastStrategies.includes('press_escape')) return { action: { name: 'press_key', params: { key: 'Escape' } }, strategyName: 'press_escape' };
      return null; // Exhausted
    }

    if (classification.classification === 'INVISIBLE') {
      if (!pastStrategies.includes('scroll_down')) return { action: { name: 'scroll', params: { direction: 'down', amount_px: 500 } }, strategyName: 'scroll_down' };
      if (!pastStrategies.includes('scroll_up')) return { action: { name: 'scroll', params: { direction: 'up', amount_px: 1000 } }, strategyName: 'scroll_up' };
      return null;
    }

    if (classification.classification === 'DETACHED') {
      // Detached means it's gone from DOM.
      if (!pastStrategies.includes('wait_reobserve')) return { action: { name: 'wait_until', params: { condition: 'dom_stable', timeoutMs: 2000 } }, strategyName: 'wait_reobserve' };
      return null;
    }

    if (classification.classification === 'ANIMATING') {
      if (!pastStrategies.includes('wait_stable')) return { action: { name: 'wait_until', params: { condition: 'dom_stable', timeoutMs: 2000 } }, strategyName: 'wait_stable' };
      return null;
    }

    if (classification.classification === 'UNKNOWN') {
      if (!pastStrategies.includes('wait_short')) return { action: { name: 'wait_until', params: { condition: 'network_quiet', timeoutMs: 1000 } }, strategyName: 'wait_short' };
      if (!pastStrategies.includes('retry_action')) return { action: { name: 'wait_until', params: { condition: 'dom_stable', timeoutMs: 500 } }, strategyName: 'retry_action' }; // Just retry
      return null;
    }

    return null;
  }
}
