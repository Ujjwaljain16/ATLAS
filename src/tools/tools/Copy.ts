import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const CopyInputSchema = z.object({
  elementId: z.string().optional(),
});
export type CopyInput = z.infer<typeof CopyInputSchema>;

export class CopyTool implements ATLASTool<CopyInput, any> {
  name = 'copy';
  description = 'Copies text from an element to the clipboard, or copies the current selection if no elementId is provided';
  inputSchema = CopyInputSchema;
  timeoutMs = 5000;
  maxRetries = 1;
  
  async execute(input: CopyInput, browser: BrowserController): Promise<ToolResult<any>> {
    const start = Date.now();
    try {
      if (input.elementId) {
        const locator = await browser.locateElement(input.elementId);
        await locator.focus();
        await browser.getPage().keyboard.press('ControlOrMeta+A');
        await browser.getPage().keyboard.press('ControlOrMeta+C');
      } else {
        await browser.getPage().keyboard.press('ControlOrMeta+C');
      }
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
        error: { code: 'COPY_FAILED', message: (err as Error).message, severity: 'RECOVERABLE', source: 'ELEMENT' },
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'failure', timestamp: new Date().toISOString() },
      };
    }
  }
}
