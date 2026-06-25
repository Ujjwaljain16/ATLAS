import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';

import { v4 as uuid } from 'uuid';

export class CompleteTool implements ATLASTool<{}, null> {
  readonly name = 'complete';
  readonly description = 'Marks the goal or current step as complete.';
  readonly inputSchema = z.object({});
  readonly timeoutMs = 1000;
  readonly maxRetries = 0;

  async execute(params: {}, browser: BrowserController): Promise<ToolResult<null>> {
    const now = new Date().toISOString();
    return {
      success: true,
      data: null,
      error: null,
      timing: {
        startedAt: now,
        endedAt: now,
        durationMs: 0
      },
      actionLogEntry: {
        actionId: uuid(),
        name: 'complete',
        params,
        status: 'success',
        timestamp: now
      }
    };
  }
}
