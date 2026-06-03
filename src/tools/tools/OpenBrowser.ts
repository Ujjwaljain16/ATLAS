import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';
import { v4 as uuid } from 'uuid';

export class OpenBrowserTool implements ATLASTool<any, void> {
  name = 'open_browser';
  description = 'Launches the playwright browser';
  inputSchema = z.any();
  timeoutMs = 15000;
  maxRetries = 1;

  async execute(params: any, browser: BrowserController): Promise<ToolResult<void>> {
    const startedAt = new Date().toISOString();
    const result = await browser.launch(params);
    const endedAt = new Date().toISOString();

    if (!result.success) {
      return {
        success: false,
        data: null,
        error: {
          code: 'LAUNCH_FAILED',
          message: result.error?.message || 'Browser failed to launch',
          severity: 'FATAL',
          source: 'BROWSER'
        },
        timing: { startedAt, endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt) },
        actionLogEntry: { actionId: uuid(), name: this.name, params, status: 'failure', timestamp: endedAt }
      };
    }

    return {
      success: true,
      data: null,
      error: null,
      timing: { startedAt, endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt) },
      actionLogEntry: { actionId: uuid(), name: this.name, params, status: 'success', timestamp: endedAt }
    };
  }
}
