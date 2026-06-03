import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const SelectOptionInputSchema = z.object({
  elementId: z.string(),
  text: z.string(), // The visible text to select
});
export type SelectOptionInput = z.infer<typeof SelectOptionInputSchema>;

export interface SelectOptionData {
  selectedValues: string[];
}

export class SelectOptionTool implements ATLASTool<SelectOptionInput, SelectOptionData> {
  name = 'select_option';
  description = 'Selects an option from a dropdown element identified by elementId';
  inputSchema = SelectOptionInputSchema;
  timeoutMs = 15000;
  maxRetries = 2;
  
  async execute(input: SelectOptionInput, browser: BrowserController): Promise<ToolResult<SelectOptionData>> {
    const start = Date.now();
    
    try {
      const locator = await browser.locateElement(input.elementId);
      
      // Select the option by its visible text label
      const selected = await locator.selectOption({ label: input.text });
      
      return {
        success: true,
        data: { 
          selectedValues: selected 
        },
        error: null,
        timing: this.buildTiming(start),
        actionLogEntry: this.buildActionLog(input, 'success'),
      };
      
    } catch (err) {
      return {
        success: false,
        data: null,
        error: {
          code: 'SELECT_OPTION_FAILED',
          message: (err as Error).message,
          severity: 'RECOVERABLE',
          source: 'ELEMENT',
        },
        timing: this.buildTiming(start),
        actionLogEntry: this.buildActionLog(input, 'failure'),
      };
    }
  }

  private buildTiming(start: number) {
    return {
      startedAt: new Date(start).toISOString(),
      endedAt: new Date().toISOString(),
      durationMs: Date.now() - start
    };
  }

  private buildActionLog(input: SelectOptionInput, status: 'success' | 'failure') {
    return {
      actionId: Math.random().toString(),
      name: this.name,
      params: input,
      status,
      timestamp: new Date().toISOString()
    };
  }
}
