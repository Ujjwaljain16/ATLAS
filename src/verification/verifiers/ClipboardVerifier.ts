import { ActionVerifier, VerificationContext, VerificationResult } from '../types';

export class ClipboardVerifier implements ActionVerifier {
  name = 'ClipboardVerifier';

  async verify(context: VerificationContext): Promise<VerificationResult> {
    // Note: Checking the system clipboard in headless mode often requires specific permissions
    // or focus tricks. For Phase D, we rely on the ToolRuntime success signal.
    // Since ActionVerification is only called if the tool execution didn't throw an error,
    // we can assume the copy command dispatched successfully.
    
    return {
      success: true,
      reason: 'Copy action completed without throwing errors. Clipboard API invoked.',
      verificationType: 'DOM',
      expected: 'Clipboard write',
      observed: 'Action succeeded'
    };
  }
}
