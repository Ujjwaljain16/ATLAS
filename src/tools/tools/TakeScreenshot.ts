import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const TakeScreenshotInputSchema = z.object({
  label: z.string().default('screenshot'),
  fullPage: z.boolean().default(false)
});
export type TakeScreenshotInput = z.infer<typeof TakeScreenshotInputSchema>;

export interface TakeScreenshotData {
  path: string;
}

export class TakeScreenshotTool implements ATLASTool<TakeScreenshotInput, TakeScreenshotData> {
  name = 'take_screenshot';
  description = 'Takes a screenshot of the current page';
  inputSchema = TakeScreenshotInputSchema;
  timeoutMs = 15000;
  maxRetries = 1;
  
  async execute(input: TakeScreenshotInput, browser: BrowserController): Promise<ToolResult<TakeScreenshotData>> {
    const start = Date.now();
    
    try {
      const path = await browser.screenshot(input.label, input.fullPage);
      
      return {
        success: true,
        data: { path },
        error: null,
        timing: this.buildTiming(start),
        actionLogEntry: this.buildActionLog(input, 'success'),
      };
      
    } catch (err) {
      return {
        success: false,
        data: null,
        error: {
          code: 'SCREENSHOT_FAILED',
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

  private buildActionLog(input: TakeScreenshotInput, status: 'success' | 'failure') {
    return {
      actionId: Math.random().toString(),
      name: this.name,
      params: input,
      status,
      timestamp: new Date().toISOString()
    };
  }
}
