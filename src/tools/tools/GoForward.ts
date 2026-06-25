import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const GoForwardInputSchema = z.object({});
export type GoForwardInput = z.infer<typeof GoForwardInputSchema>;

export class GoForwardTool implements ATLASTool<GoForwardInput, void> {
  name = 'go_forward';
  description = 'Navigates forward one page in history';
  inputSchema = GoForwardInputSchema;
  timeoutMs = 15000;
  maxRetries = 1;
  
  async execute(input: GoForwardInput, browser: BrowserController): Promise<ToolResult<void>> {
    const start = Date.now();
    try {
      const page = browser.getPage();
      if (!page) throw new Error("Page not available");
      await page.goForward();
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
        error: { code: 'GO_FORWARD_FAILED', message: (err as Error).message, severity: 'RECOVERABLE', source: 'SYSTEM' },
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'failure', timestamp: new Date().toISOString() },
      };
    }
  }
}
