import { z } from 'zod';
import { ATLASTool, ToolResult } from '../types';
import { BrowserController } from '../../browser/BrowserController';
import { v4 as uuid } from 'uuid';

export class NavigateTool implements ATLASTool<{ url: string, allowedDomains?: string[] }, void> {
  name = 'navigate_to_url';
  description = 'Navigates to a specific URL';
  inputSchema = z.object({
    url: z.string().url(),
    allowedDomains: z.array(z.string()).optional(),
    strictDomainCheck: z.boolean().optional()
  });
  timeoutMs = 30000;
  maxRetries = 2;

  async execute(params: { url: string, allowedDomains?: string[], strictDomainCheck?: boolean }, browser: BrowserController): Promise<ToolResult<void>> {
    const startedAt = new Date().toISOString();
    const result = await browser.navigate(params.url, { timeoutMs: this.timeoutMs, allowedDomains: params.allowedDomains, strictDomainCheck: params.strictDomainCheck });
    const endedAt = new Date().toISOString();

    if (!result.success) {
      return {
        success: false,
        data: null,
        error: {
          code: 'NAVIGATION_FAILED',
          message: result.error?.message || 'Failed to navigate',
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
