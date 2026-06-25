import { ActionVerifier, VerificationContext, VerificationResult } from '../types';
import { SemanticIdentityResolver } from '../SemanticIdentityResolver';

export class TypeVerifier implements ActionVerifier {
  name = 'TypeVerifier';

  async verify(context: VerificationContext): Promise<VerificationResult> {
    const targetElementId = context.action.params?.elementId;
    const textToType = context.action.params?.text;

    if (!targetElementId || !textToType) {
      return {
        success: true,
        reason: 'No elementId or text provided in type action.',
        verificationType: 'DOM',
      };
    }

    const afterElement = SemanticIdentityResolver.resolve(targetElementId, context.beforeState, context.afterState);
    
    if (!afterElement) {
      return {
        success: false,
        reason: `Target element ${targetElementId} disappeared from DOM after typing.`,
        verificationType: 'DOM',
        expected: textToType,
        observed: 'Element missing'
      };
    }

    const observedValue = afterElement.value || afterElement.text || '';
    
    // Check if the typed text is contained within the element's value
    if (observedValue.includes(textToType)) {
      return {
        success: true,
        reason: `DOM state verified: Input value contains expected text.`,
        verificationType: 'DOM',
        expected: textToType,
        observed: observedValue
      };
    }

    return {
      success: false,
      reason: `DOM state mismatch: Input value does not contain the typed text.`,
      verificationType: 'DOM',
      expected: textToType,
      observed: observedValue
    };
  }
}
