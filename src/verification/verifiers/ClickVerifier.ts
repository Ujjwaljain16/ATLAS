import { ActionVerifier, VerificationContext, VerificationResult } from '../types';
import { SemanticIdentityResolver } from '../SemanticIdentityResolver';

export class ClickVerifier implements ActionVerifier {
  name = 'ClickVerifier';

  async verify(context: VerificationContext): Promise<VerificationResult> {
    // URL changed?
    if (context.beforeState.url !== context.afterState.url) {
      return {
        success: true,
        reason: 'URL mutated after click.',
        verificationType: 'URL',
        expected: 'URL Change',
        observed: context.afterState.url
      };
    }

    // Number of elements significantly changed?
    const domDiff = Math.abs(context.beforeState.elements.length - context.afterState.elements.length);
    if (domDiff > 5) {
      return {
        success: true,
        reason: `DOM mutated significantly (${domDiff} elements difference).`,
        verificationType: 'DOM',
        expected: 'DOM Mutation',
        observed: `${domDiff} elements changed`
      };
    }

    // Did the target element disappear?
    const targetElementId = context.action.params?.elementId;
    if (targetElementId) {
      const stillExists = SemanticIdentityResolver.resolve(targetElementId, context.beforeState, context.afterState);
      if (!stillExists) {
        return {
          success: true,
          reason: 'Target element disappeared (dialog closed, dropdown selected, or page updated).',
          verificationType: 'DOM',
          expected: 'Element mutated/disappeared',
          observed: 'Element missing'
        };
      }
    }

    // If none of the deterministic checks fired, return failure so it can fallback or retry.
    // Wait, some clicks are just toggles. Let's return success but mark it as uncertain,
    // or let it pass for now. The GenericLLMVerifier would be a better fallback, but since
    // we want to be strict, let's say it failed if there's no visible change.
    // Actually, in many cases like checkboxes, a click changes the "checked" attribute.
    if (targetElementId) {
      const beforeEl = context.beforeState.elements.find((e: any) => e.id === targetElementId);
      const afterEl = SemanticIdentityResolver.resolve(targetElementId, context.beforeState, context.afterState);
      if (beforeEl && afterEl) {
        if (beforeEl.checked !== afterEl.checked) {
          return {
            success: true,
            reason: `Element checked state toggled to ${afterEl.checked}`,
            verificationType: 'DOM',
            expected: 'State change',
            observed: `checked: ${afterEl.checked}`
          };
        }
      }
    }

    return {
      success: false, // Strict verification: if we clicked and NOTHING happened, it's a failure.
      reason: 'No observable URL or DOM state mutation detected after click.',
      verificationType: 'DOM',
      expected: 'Observable mutation',
      observed: 'State identical'
    };
  }
}
