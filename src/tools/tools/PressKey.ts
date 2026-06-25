import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const PressKeyInputSchema = z.object({
  key: z.string(),
  elementId: z.string().optional(),
});
export type PressKeyInput = z.infer<typeof PressKeyInputSchema>;

export class PressKeyTool implements ATLASTool<PressKeyInput, void> {
  name = 'press_key';
  description = 'Presses a specific keyboard key (e.g. Enter, Escape, Tab)';
  inputSchema = PressKeyInputSchema;
  timeoutMs = 10000;
  maxRetries = 1;
  
  async execute(input: PressKeyInput, browser: BrowserController): Promise<ToolResult<void>> {
    const start = Date.now();
    try {
      if (input.elementId) {
        const locator = await browser.locateElement(input.elementId);
        await locator.press(input.key);
      } else {
        const page = browser.getPage();
        if (!page) throw new Error("Page not available");
        await page.keyboard.press(input.key);
      }
      return {
        success: true,
        data: undefined,
        error: null,
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'success', timestamp: new Date().toISOString() },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: { code: 'PRESS_KEY_FAILED', message: (err as Error).message, severity: 'RECOVERABLE', source: 'SYSTEM' },
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'failure', timestamp: new Date().toISOString() },
      };
    }
  }
}
