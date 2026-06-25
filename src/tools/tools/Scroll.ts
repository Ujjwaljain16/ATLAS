import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

export const ScrollInputSchema = z.object({
  direction: z.enum(['up', 'down', 'left', 'right']).optional(),
  amount: z.number().optional()
});
export type ScrollInput = z.infer<typeof ScrollInputSchema>;

export interface ScrollMetrics {
  previousTop: number;
  currentTop: number;
  delta: number;
  viewportHeight: number;
  documentHeight: number;
  maxScrollTop: number;
  isBottom: boolean;
  progress: number;
  newNodes: number;
  domChanged: boolean;
  stableFrames: number;
  networkIdle: boolean;
}

export class ScrollTool implements ATLASTool<ScrollInput, ScrollMetrics> {
  name = 'scroll';
  description = 'Scrolls the page or a specific element';
  inputSchema = ScrollInputSchema;
  timeoutMs = 10000;
  maxRetries = 1;
  
  async execute(input: ScrollInput, browser: BrowserController): Promise<ToolResult<ScrollMetrics>> {
    const start = Date.now();
    
    try {
      const page = browser.getPage();
      if (!page) throw new Error('Page not available for scrolling');

      // 1. Measure initial state
      const beforeState = await page.evaluate(() => {
        return {
          scrollTop: window.scrollY || document.documentElement.scrollTop,
          scrollHeight: document.body.scrollHeight,
          clientHeight: window.innerHeight,
          nodeCount: document.querySelectorAll('*').length
        };
      });

      // 2. Execute scroll
      const amount = input.amount || Math.max(500, beforeState.clientHeight * 0.9);
      const direction = input.direction || 'down';
      await browser.pageOperations.scroll(direction, amount);

      // 4. Measure final state
      const afterState = await page.evaluate(() => {
        return {
          scrollTop: window.scrollY || document.documentElement.scrollTop,
          scrollHeight: document.body.scrollHeight,
          clientHeight: window.innerHeight,
          nodeCount: document.querySelectorAll('*').length
        };
      });

      const maxScrollTop = Math.max(0, afterState.scrollHeight - afterState.clientHeight);
      const isBottom = afterState.scrollTop >= maxScrollTop - 5; // 5px buffer
      const progress = maxScrollTop > 0 ? Math.min(1, afterState.scrollTop / maxScrollTop) : 1;

      const metrics: ScrollMetrics = {
        previousTop: beforeState.scrollTop,
        currentTop: afterState.scrollTop,
        delta: Math.abs(afterState.scrollTop - beforeState.scrollTop),
        viewportHeight: afterState.clientHeight,
        documentHeight: afterState.scrollHeight,
        maxScrollTop,
        isBottom,
        progress,
        newNodes: afterState.nodeCount - beforeState.nodeCount,
        domChanged: afterState.nodeCount !== beforeState.nodeCount || afterState.scrollHeight !== beforeState.scrollHeight,
        stableFrames: 1, // Stub
        networkIdle: true // Future-proof stub
      };
      
      return {
        success: true,
        data: metrics,
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
