import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const PasteInputSchema = z.object({
  elementId: z.string().optional(),
});
export type PasteInput = z.infer<typeof PasteInputSchema>;

export class PasteTool implements ATLASTool<PasteInput, any> {
  name = 'paste';
  description = 'Pastes text from the clipboard into an element, or into the currently focused element if no elementId is provided';
  inputSchema = PasteInputSchema;
  timeoutMs = 5000;
  maxRetries = 1;
  
  async execute(input: PasteInput, browser: BrowserController): Promise<ToolResult<any>> {
    const start = Date.now();
    try {
      if (input.elementId) {
        const locator = await browser.locateElement(input.elementId);
        await locator.focus();
      }
      await browser.getPage().keyboard.press('ControlOrMeta+V');
      return {
        success: true,
        data: null,
        error: null,
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'success', timestamp: new Date().toISOString() },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: { code: 'PASTE_FAILED', message: (err as Error).message, severity: 'RECOVERABLE', source: 'ELEMENT' },
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'failure', timestamp: new Date().toISOString() },
      };
    }
  }
}
