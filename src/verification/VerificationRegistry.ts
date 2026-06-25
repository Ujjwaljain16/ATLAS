import { ActionVerifier, VerificationContext, VerificationResult } from './types';

export class VerificationRegistry {
  private verifiers: Map<string, ActionVerifier> = new Map();
  private fallbackVerifier?: ActionVerifier;

  register(actionName: string, verifier: ActionVerifier) {
    this.verifiers.set(actionName, verifier);
  }

  setFallback(verifier: ActionVerifier) {
    this.fallbackVerifier = verifier;
  }

  async verify(context: VerificationContext): Promise<VerificationResult> {
    const verifier = this.verifiers.get(context.action.name) || this.fallbackVerifier;
    
    if (!verifier) {
      return {
        success: true,
        reason: 'No verifier registered for action and no fallback defined.',
        verificationType: 'DOM',
        expected: context.expectedOutcome,
        observed: 'Unverified'
      };
    }

    return await verifier.verify(context);
  }
}
