import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const GoBackInputSchema = z.object({});
export type GoBackInput = z.infer<typeof GoBackInputSchema>;

export class GoBackTool implements ATLASTool<GoBackInput, void> {
  name = 'go_back';
  description = 'Navigates back one page in history';
  inputSchema = GoBackInputSchema;
  timeoutMs = 15000;
  maxRetries = 1;
  
  async execute(input: GoBackInput, browser: BrowserController): Promise<ToolResult<void>> {
    const start = Date.now();
    try {
      const page = browser.getPage();
      if (!page) throw new Error("Page not available");
      await page.goBack();
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
        error: { code: 'GO_BACK_FAILED', message: (err as Error).message, severity: 'RECOVERABLE', source: 'SYSTEM' },
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'failure', timestamp: new Date().toISOString() },
      };
    }
  }
}
