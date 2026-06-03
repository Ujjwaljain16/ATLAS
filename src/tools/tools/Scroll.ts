import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const ScrollInputSchema = z.object({
  elementId: z.string().optional(),
  direction: z.enum(['up', 'down', 'left', 'right']).optional(),
  amount: z.number().optional()
});
export type ScrollInput = z.infer<typeof ScrollInputSchema>;

export interface ScrollData {
  scrolled: boolean;
}

export class ScrollTool implements ATLASTool<ScrollInput, ScrollData> {
  name = 'scroll';
  description = 'Scrolls the page or a specific element';
  inputSchema = ScrollInputSchema;
  timeoutMs = 10000;
  maxRetries = 1;
  
  async execute(input: ScrollInput, browser: BrowserController): Promise<ToolResult<ScrollData>> {
    const start = Date.now();
    
    try {
      if (input.elementId) {
        const locator = await browser.locateElement(input.elementId);
        await locator.scrollIntoViewIfNeeded();
      } else {
        const page = browser.getPage();
        const amount = input.amount || 500;
        const sign = input.direction === 'up' || input.direction === 'left' ? -1 : 1;
        const x = input.direction === 'left' || input.direction === 'right' ? amount * sign : 0;
        const y = input.direction === 'up' || input.direction === 'down' ? amount * sign : amount; // Default down
        
        await page.mouse.wheel(x, y);
      }
      
      return {
        success: true,
        data: { scrolled: true },
        error: null,
        timing: this.buildTiming(start),
        actionLogEntry: this.buildActionLog(input, 'success'),
      };
      
    } catch (err) {
      return {
        success: false,
        data: null,
        error: {
          code: 'SCROLL_FAILED',
          message: (err as Error).message,
          severity: 'RECOVERABLE',
          source: 'SYSTEM',
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

  private buildActionLog(input: ScrollInput, status: 'success' | 'failure') {
    return {
      actionId: Math.random().toString(),
      name: this.name,
      params: input,
      status,
      timestamp: new Date().toISOString()
    };
  }
}
