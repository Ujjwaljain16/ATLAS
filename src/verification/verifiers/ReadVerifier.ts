import { ActionVerifier, VerificationContext, VerificationResult } from '../types';

export class ReadVerifier implements ActionVerifier {
  name = 'ReadVerifier';

  async verify(context: VerificationContext): Promise<VerificationResult> {
    // Read actions (like extract_text) don't mutate the DOM.
    // Their success is defined by returning data without throwing.
    
    const data = context.toolResult?.data;
    const isSuccess = !!data && !context.toolResult?.error;
    const textSnippet = typeof data === 'string' ? data.substring(0, 500) : JSON.stringify(data || '').substring(0, 500);

    return {
      success: isSuccess,
      reason: isSuccess ? `Extraction completed and returned ${typeof data === 'string' ? data.length : 'some'} characters.` : 'Extraction failed.',
      verificationType: 'DOM',
      expected: 'Data extraction',
      observed: isSuccess ? `Action succeeded. Extracted data: ${textSnippet}...` : 'Action failed to return data.'
    };
  }
}
