import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const DragInputSchema = z.object({
  sourceElementId: z.string(),
  targetElementId: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});
export type DragInput = z.infer<typeof DragInputSchema>;

export class DragTool implements ATLASTool<DragInput, any> {
  name = 'drag';
  description = 'Drags an element to another element or specific coordinates';
  inputSchema = DragInputSchema;
  timeoutMs = 15000;
  maxRetries = 2;
  
  async execute(input: DragInput, browser: BrowserController): Promise<ToolResult<any>> {
    const start = Date.now();
    try {
      const sourceLocator = await browser.locateElement(input.sourceElementId);
      
      if (input.targetElementId) {
        const targetLocator = await browser.locateElement(input.targetElementId);
        await sourceLocator.dragTo(targetLocator);
      } else if (input.x !== undefined && input.y !== undefined) {
        await sourceLocator.hover();
        const page = browser.getPage();
        await page.mouse.down();
        await page.mouse.move(input.x, input.y);
        await page.mouse.up();
      } else {
        throw new Error("Must provide either targetElementId or x/y coordinates");
      }
      
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
        error: { code: 'DRAG_FAILED', message: (err as Error).message, severity: 'RECOVERABLE', source: 'ELEMENT' },
        timing: { startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - start },
        actionLogEntry: { actionId: Math.random().toString(), name: this.name, params: input, status: 'failure', timestamp: new Date().toISOString() },
      };
    }
  }
}
