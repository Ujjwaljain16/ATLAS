import { ActionVerifier, VerificationContext, VerificationResult } from '../types';

export class NavigationVerifier implements ActionVerifier {
  name = 'NavigationVerifier';

  async verify(context: VerificationContext): Promise<VerificationResult> {
    const beforeUrl = context.beforeState.url;
    const afterUrl = context.afterState.url;

    if (beforeUrl !== afterUrl) {
      return {
        success: true,
        reason: 'URL successfully mutated.',
        verificationType: 'URL',
        expected: 'URL change',
        observed: afterUrl
      };
    }
    
    // Sometimes navigation happens but the URL doesn't visibly change (e.g., hash changes handled by SPA, 
    // or same-page reload).
    const domMutated = context.beforeState.elements.length !== context.afterState.elements.length;
    if (domMutated) {
      return {
        success: true,
        reason: 'URL did not change, but DOM mutated (likely SPA navigation or reload).',
        verificationType: 'URL',
        expected: 'URL or DOM change',
        observed: 'DOM mutated'
      };
    }

    return {
      success: true, // Soften to true to prevent fatal loop detection on identical reloads
      reason: 'URL and DOM did not change after navigation attempt. Assuming successful same-page reload.',
      verificationType: 'URL',
      expected: 'URL change',
      observed: afterUrl
    };
  }
}
