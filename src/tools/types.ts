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
  error?: {
    code: string;
    message: string;
    severity: 'FATAL' | 'RECOVERABLE' | 'TRANSIENT';
    source: 'BROWSER' | 'NETWORK' | 'SYSTEM' | 'ELEMENT';
  } | null;
  artifacts?: any[]; // ObservationArtifact[]
  timing?: {
    startedAt: string;
    endedAt: string;
    durationMs: number;
  };
  actionLogEntry?: any;
}

export interface ToolMetadata {
  arguments: any;
  preconditions: string;
  postconditions: string;
  sideEffects: string;
  cost: number;
  verifiable: boolean;
  supportsRetry: boolean;
  supportsRecovery: boolean;
  failureModes: string[];
}

export interface InteractionState {
  visible: boolean;
  enabled: boolean;
  editable: boolean;
  focused: boolean;
}

export interface ATLASTool<TInput, TData> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  timeoutMs: number;
  maxRetries: number;
  
  // Phase A: Capability Registry
  metadata?: Partial<ToolMetadata>;

  // Phase B: Generic Interaction Engine
  requiredState?: Partial<InteractionState>;
  
  execute(input: TInput, browser: BrowserController): Promise<ToolResult<TData>>;
}

export interface Action {
  name: string;
  params: any;
}
