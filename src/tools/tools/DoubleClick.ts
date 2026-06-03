import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const DoubleClickInputSchema = z.object({
  elementId: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});
export type DoubleClickInput = z.infer<typeof DoubleClickInputSchema>;

export interface DoubleClickData {
  clickedElementId?: string;
}

export class DoubleClickTool implements ATLASTool<DoubleClickInput, DoubleClickData> {
  name = 'double_click';
  description = 'Double clicks on an element or specific coordinates';
  inputSchema = DoubleClickInputSchema;
  timeoutMs = 10000;
  maxRetries = 2;
  
  async execute(input: DoubleClickInput, browser: BrowserController): Promise<ToolResult<DoubleClickData>> {
    const start = Date.now();
    
    try {
      if (input.elementId) {
        const locator = await browser.locateElement(input.elementId);
        await locator.dblclick();
      } else if (input.x !== undefined && input.y !== undefined) {
        const page = browser.getPage();
        await page.mouse.dblclick(input.x, input.y);
      } else {
        throw new Error("Must provide either elementId or x/y coordinates");
      }
      
      return {
        success: true,
        data: { clickedElementId: input.elementId },
        error: null,
        timing: this.buildTiming(start),
        actionLogEntry: this.buildActionLog(input, 'success'),
      };
      
    } catch (err) {
      return {
        success: false,
        data: null,
        error: {
          code: 'DBLCLICK_FAILED',
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

  private buildActionLog(input: DoubleClickInput, status: 'success' | 'failure') {
    return {
      actionId: Math.random().toString(),
      name: this.name,
      params: input,
      status,
      timestamp: new Date().toISOString()
    };
  }
}
