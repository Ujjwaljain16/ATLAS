import { z } from 'zod';
import { BrowserController } from '../browser/BrowserController';

export interface ActionLogEntry {
  actionId: string;
  name: string;
  params: any;
  status: 'success' | 'failure';
  timestamp: string;
}

export interface ToolError {
  code: string;
  message: string;
  severity: 'RECOVERABLE' | 'TRANSIENT' | 'FATAL';
  source: 'BROWSER' | 'NETWORK' | 'ELEMENT' | 'SYSTEM';
}

export interface ToolResult<T> {
  success: boolean;
  data: T | null;
  error: ToolError | null;
  timing: {
    startedAt: string;
    endedAt: string;
    durationMs: number;
  };
  actionLogEntry: ActionLogEntry;
}

export interface ATLASTool<TInput, TData> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  timeoutMs: number;
  maxRetries: number;
  execute(input: TInput, browser: BrowserController): Promise<ToolResult<TData>>;
}

export interface Action {
  name: string;
  params: any;
}
