import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';
import { WaitStrategies, WaitConditionType } from '../../browser/WaitStrategies';

export const WaitInputSchema = z.object({
  condition: z.enum(['NETWORK_IDLE', 'DOM_STABLE', 'ELEMENT_VISIBLE', 'ELEMENT_HIDDEN', 'URL_CONTAINS', 'TEXT_APPEARS', 'MS']).default('DOM_STABLE'),
  value: z.string().optional(),
  timeoutMs: z.number().optional()
});
export type WaitInput = z.infer<typeof WaitInputSchema>;

export class WaitTool implements ATLASTool<WaitInput, void> {
  name = 'wait';
  description = 'Waits for a specific condition (e.g., DOM_STABLE, NETWORK_IDLE, ELEMENT_VISIBLE) or a fixed duration';
  inputSchema = WaitInputSchema;
  timeoutMs = 30000;
  maxRetries = 1;
  metadata = {
    arguments: { ms: 'number (required)' },
    preconditions: 'None.',
    postconditions: 'Time has elapsed.',
    sideEffects: 'None directly, allows async page updates to settle.',
    cost: 1,
    verifiable: true,
    supportsRetry: false,
    supportsRecovery: false,
    failureModes: ['Timeout']
  };
  
  async execute(input: WaitInput, browser: BrowserController): Promise<ToolResult<void>> {
    const start = Date.now();
    try {
      if (input.condition === 'MS') {
        await new Promise(resolve => setTimeout(resolve, input.timeoutMs || 1000));
      } else {
        const page = browser.getPage();
        const success = await WaitStrategies.waitFor(page, {
          type: input.condition as WaitConditionType,
          value: input.value,
          timeoutMs: input.timeoutMs
        });
        if (!success) {
          throw new Error(`Wait condition ${input.condition} timed out`);
        }
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
        error: { code: 'WAIT_FAILED', message: (err as Error).message, severity: 'RECOVERABLE', source: 'SYSTEM' },
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'failure', timestamp: new Date().toISOString() },
      };
    }
  }
}
