import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const HoverInputSchema = z.object({
  elementId: z.string(),
});
export type HoverInput = z.infer<typeof HoverInputSchema>;

export class HoverTool implements ATLASTool<HoverInput, void> {
  name = 'hover';
  description = 'Hovers over an element';
  inputSchema = HoverInputSchema;
  timeoutMs = 10000;
  maxRetries = 1;
  
  async execute(input: HoverInput, browser: BrowserController): Promise<ToolResult<void>> {
    const start = Date.now();
    try {
      const locator = await browser.locateElement(input.elementId);
      await locator.hover();
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
        error: { code: 'HOVER_FAILED', message: (err as Error).message, severity: 'RECOVERABLE', source: 'ELEMENT' },
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'failure', timestamp: new Date().toISOString() },
      };
    }
  }
}
