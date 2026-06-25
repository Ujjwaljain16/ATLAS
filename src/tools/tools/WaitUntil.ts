import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const WaitUntilInputSchema = z.object({
  condition: z.enum(['element_visible', 'network_quiet', 'url_changed', 'dom_stable']),
  elementId: z.string().optional(),
  timeoutMs: z.number().optional().default(10000)
});
export type WaitUntilInput = z.infer<typeof WaitUntilInputSchema>;

export class WaitUntilTool implements ATLASTool<WaitUntilInput, any> {
  name = 'wait_until';
  description = 'Wait until a specific condition is met before proceeding. Use this instead of a fixed sleep.';
  inputSchema = WaitUntilInputSchema;
  timeoutMs = 30000;
  maxRetries = 1;
  metadata = {
    arguments: { condition: "'element_visible' | 'network_quiet' | 'url_changed' | 'dom_stable'", timeoutMs: 'number (optional)' },
    preconditions: 'Condition is expected to occur.',
    postconditions: 'Condition is met or throws Timeout.',
    sideEffects: 'None.',
    cost: 2,
    verifiable: true,
    supportsRetry: true,
    supportsRecovery: true,
    failureModes: ['Timeout']
  };
  
  async execute(input: WaitUntilInput, browser: BrowserController): Promise<ToolResult<any>> {
    const start = Date.now();
    
    try {
      const page = browser.getPage();
      
      switch (input.condition) {
        case 'element_visible':
          if (!input.elementId) throw new Error('elementId required for element_visible condition');
          const locator = await browser.locateElement(input.elementId);
          await locator.waitFor({ state: 'visible', timeout: input.timeoutMs });
          break;
        case 'network_quiet':
          await page.waitForLoadState('networkidle', { timeout: input.timeoutMs });
          break;
        case 'url_changed':
          const currentUrl = page.url();
          await page.waitForURL((url) => url.toString() !== currentUrl, { timeout: input.timeoutMs });
          break;
        case 'dom_stable':
          await page.waitForLoadState('domcontentloaded', { timeout: input.timeoutMs });
          break;
      }
      
      return {
        success: true,
        data: { condition: input.condition, met: true },
        error: null,
        timing: this.buildTiming(start),
        actionLogEntry: this.buildActionLog(input, 'success'),
      };
      
    } catch (err: any) {
      return {
        success: false,
        data: null,
        error: {
          code: 'WAIT_CONDITION_FAILED',
          message: err.message,
          severity: 'RECOVERABLE',
          source: 'SYSTEM',
        },
        timing: this.buildTiming(start),
        actionLogEntry: this.buildActionLog(input, 'failure'),
      };
    }
  }

  private buildTiming(start: number) {
    return { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start };
  }

  private buildActionLog(input: WaitUntilInput, status: 'success' | 'failure') {
    return { actionId: Math.random().toString(), name: this.name, params: input, status, timestamp: new Date().toISOString() };
  }
}
