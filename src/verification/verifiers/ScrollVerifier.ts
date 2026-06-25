import { ActionVerifier, VerificationContext, VerificationResult } from '../types';

export class ScrollVerifier implements ActionVerifier {
  name = 'ScrollVerifier';

  async verify(context: VerificationContext): Promise<VerificationResult> {
    const beforeY = context.beforeState.pageMetadata.scrollY;
    const afterY = context.afterState.pageMetadata.scrollY;
    const beforeX = context.beforeState.pageMetadata.scrollX;
    const afterX = context.afterState.pageMetadata.scrollX;

    if (beforeY !== afterY || beforeX !== afterX) {
      return {
        success: true,
        reason: `Scroll position changed from (${beforeX}, ${beforeY}) to (${afterX}, ${afterY}).`,
        verificationType: 'DOM',
        expected: 'Scroll position change',
        observed: `(${afterX}, ${afterY})`
      };
    }

    return {
      success: false,
      reason: 'Scroll position did not change. The page might be at the boundary or the element is not scrollable.',
      verificationType: 'DOM',
      expected: 'Scroll position change',
      observed: `(${afterX}, ${afterY})`
    };
  }
}
