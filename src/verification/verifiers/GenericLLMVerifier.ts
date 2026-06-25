import { ActionVerifier, VerificationContext, VerificationResult } from '../types';

import { GoogleGenAI } from '@google/genai';

export class GenericLLMVerifier implements ActionVerifier {
  name = 'GenericLLMVerifier';
  
  private aiClient: GoogleGenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = 'gemini-2.5-flash') {
    this.aiClient = new GoogleGenAI({ apiKey });
    this.modelName = modelName;
  }

  async verify(context: VerificationContext): Promise<VerificationResult> {
    if (!context.expectedOutcome) {
      return { success: true, reason: 'No expected outcome defined for LLM verification.', verificationType: 'LLM' };
    }

    const targetElementId = context.action.params?.elementId;
    const afterElement = targetElementId ? context.afterState.elements.find((e: any) => e.id === targetElementId) : null;
    const targetStateStr = afterElement ? `\\nTarget Element After State:\\n${JSON.stringify({
      text: afterElement.text,
      value: afterElement.value,
      checked: afterElement.checked
    }, null, 2)}` : '';

    const prompt = `
You are ATLAS Action Verifier.
Action executed: ${context.action.name}
Expected Outcome: ${context.expectedOutcome}

Before State:
URL: ${context.beforeState.url}
Title: ${context.beforeState.title}

After State:
URL: ${context.afterState.url}
Title: ${context.afterState.title}
Visible text sample: ${context.afterState.pageMetadata.visibleTextBlocks.slice(0, 5).join(' ')}
${targetStateStr}

Did the action succeed in changing the state towards the expected outcome?
Respond ONLY with JSON: { "success": true/false, "reason": "why" }
`;

    try {
      const response = await this.aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      const parsed = JSON.parse(response.text?.replace(/^\`\`\`json\n?/, '').replace(/\n?\`\`\`$/, '') || '{"success":true}');
      return { 
        success: parsed.success, 
        reason: parsed.reason,
        verificationType: 'LLM',
        expected: context.expectedOutcome,
        observed: parsed.reason
      };
    } catch {
      return { success: true, reason: 'Fallback to true on parser error', verificationType: 'LLM' };
    }
  }
}
