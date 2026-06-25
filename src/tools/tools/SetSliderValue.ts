import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const SetSliderValueInputSchema = z.object({
  elementId: z.string(),
  value: z.number(),
});
export type SetSliderValueInput = z.infer<typeof SetSliderValueInputSchema>;

export class SetSliderValueTool implements ATLASTool<SetSliderValueInput, any> {
  name = 'set_slider_value';
  description = 'Sets the value of a slider input';
  inputSchema = SetSliderValueInputSchema;
  timeoutMs = 5000;
  maxRetries = 1;
  
  async execute(input: SetSliderValueInput, browser: BrowserController): Promise<ToolResult<any>> {
    const start = Date.now();
    try {
      const locator = await browser.locateElement(input.elementId);
      await locator.evaluate((node: HTMLInputElement, value: number) => {
        node.value = value.toString();
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      }, input.value);
      
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
        error: { code: 'SET_SLIDER_FAILED', message: (err as Error).message, severity: 'RECOVERABLE', source: 'ELEMENT' },
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'failure', timestamp: new Date().toISOString() },
      };
    }
  }
}
