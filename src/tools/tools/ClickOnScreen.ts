import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const ClickOnScreenInputSchema = z.object({
  elementId: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});
export type ClickOnScreenInput = z.infer<typeof ClickOnScreenInputSchema>;

export interface ClickOnScreenData {
  clickedElementId?: string;
  x?: number;
  y?: number;
}

export class ClickOnScreenTool implements ATLASTool<ClickOnScreenInput, ClickOnScreenData> {
  name = 'click';
  description = 'Clicks on an element specified by its ID';
  inputSchema = ClickOnScreenInputSchema;
  timeoutMs = 15000;
  maxRetries = 2;
  requiredState = {
    visible: true,
    enabled: true
  };

  metadata = {
    arguments: { elementId: 'string (optional)', x: 'number (optional)', y: 'number (optional)' },
    preconditions: 'Element must be visible and interactive.',
    postconditions: 'Element is clicked. May trigger navigation or state changes.',
    sideEffects: 'Focus changes, possible page load.',
    cost: 1,
    verifiable: true,
    supportsRetry: true,
    supportsRecovery: true,
    failureModes: ['ElementHidden', 'ElementDetached', 'NavigationInterrupted', 'ModalBlocked']
  };
  
  async execute(input: ClickOnScreenInput, browser: BrowserController): Promise<ToolResult<ClickOnScreenData>> {
    const start = Date.now();
    
    try {
      if (input.elementId) {
        const locator = await browser.locateElement(input.elementId);
        try {
          await locator.click({ timeout: 5000 });
        } catch (strictErr) {
          console.warn('[WARN] Strict click failed, attempting forced Playwright click...');
          try {
            await locator.click({ force: true, timeout: 5000 });
          } catch (forceErr) {
            console.warn('[WARN] Forced click failed, attempting raw JS click...');
            await locator.evaluate((node: any) => node.click());
          }
        }
      } else if (input.x !== undefined && input.y !== undefined) {
        const page = browser.getPage(); // Need to check if getPage is exposed
        if (!page) throw new Error("Page not available");
        await page.mouse.click(input.x, input.y);
      } else {
        throw new Error("Must provide either elementId or x/y coordinates");
      }

      // Small delay to allow JS frameworks/modals to render before observation
      await new Promise(r => setTimeout(r, 500));
      
      return {
        success: true,
        data: { 
          clickedElementId: input.elementId,
          x: input.x,
          y: input.y
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
          code: 'CLICK_FAILED',
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

  private buildActionLog(input: ClickOnScreenInput, status: 'success' | 'failure') {
    return {
      actionId: Math.random().toString(),
      name: this.name,
      params: input,
      status,
      timestamp: new Date().toISOString()
    };
  }
}
