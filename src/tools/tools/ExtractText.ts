import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';
import { v4 as uuid } from 'uuid';

export const ExtractTextInputSchema = z.object({
  elementId: z.string().optional().describe('The ID of the element to extract text from. If omitted, extracts from the whole page.'),
});
export type ExtractTextInput = z.infer<typeof ExtractTextInputSchema>;

export class ExtractTextTool implements ATLASTool<ExtractTextInput, string> {
  name = 'extract_text';
  description = 'Extracts visible text content from a specific element or the entire page.';
  inputSchema = ExtractTextInputSchema;
  timeoutMs = 10000;
  maxRetries = 1;
  metadata = {
    arguments: { elementId: 'string (optional)' },
    preconditions: 'Element must be visible.',
    postconditions: 'Text is extracted.',
    sideEffects: 'None',
    cost: 1,
    verifiable: true,
    supportsRetry: true,
    supportsRecovery: false,
    failureModes: ['ElementNotFound', 'Timeout']
  };
  
  async execute(input: ExtractTextInput, browser: BrowserController): Promise<ToolResult<string>> {
    const start = Date.now();
    try {
      let textContent = '';
      if (input.elementId) {
        const locator = await browser.locateElement(input.elementId);
        textContent = await locator.evaluate((el: any) => el.innerText || el.textContent || '');
      } else {
        textContent = await browser.getPage().evaluate(() => document.body.innerText || '');
      }
      
      const extractedText = textContent.substring(0, 5000); // Limit size for safety
      const url = browser.getPage().url();
      const artifact = {
        id: uuid(),
        type: 'Text',
        source: url,
        content: extractedText,
        confidence: 1.0
      };

      return {
        success: true,
        data: extractedText,
        artifacts: [artifact],
        error: null,
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: uuid(), name: this.name, params: input, status: 'success', timestamp: new Date().toISOString() },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: { code: 'EXTRACT_FAILED', message: (err as Error).message, severity: 'RECOVERABLE', source: 'ELEMENT' },
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'failure', timestamp: new Date().toISOString() },
      };
    }
  }
}
