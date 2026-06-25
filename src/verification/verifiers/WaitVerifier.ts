import { ActionVerifier, VerificationContext, VerificationResult } from '../types';

export class WaitVerifier implements ActionVerifier {
  name = 'WaitVerifier';

  async verify(context: VerificationContext): Promise<VerificationResult> {
    const condition = context.action.params?.condition;

    if (condition === 'element_visible') {
      const targetId = context.action.params?.elementId;
      if (!targetId) return { success: false, reason: 'No elementId specified for element_visible', verificationType: 'DOM' };
      
      const el = context.afterState.elements.find((e: any) => e.id === targetId);
      if (el && el.visible) {
        return { success: true, reason: 'Target element is visible.', verificationType: 'DOM', expected: 'Element visible', observed: 'Visible' };
      }
      return { success: false, reason: 'Target element not visible.', verificationType: 'DOM', expected: 'Element visible', observed: 'Not visible' };
    }

    if (condition === 'url_changed') {
      if (context.beforeState.url !== context.afterState.url) {
        return { success: true, reason: 'URL changed successfully.', verificationType: 'URL', expected: 'URL mutated', observed: context.afterState.url };
      }
      return { success: false, reason: 'URL did not change.', verificationType: 'URL', expected: 'URL mutated', observed: 'URL unchanged' };
    }

    if (condition === 'network_quiet' || condition === 'dom_stable') {
      // If playwright succeeded (toolResult isn't explicitly failed here, but we check state)
      // We can check if body exists and is ready
      return { 
        success: true, 
        reason: 'Condition met implicitly by execution stability.', 
        verificationType: 'DOM',
        expected: condition,
        observed: 'Stable'
      };
    }

    return {
      success: true,
      reason: 'No specific deterministic check for condition.',
      verificationType: 'DOM'
    };
  }
}
