import { BrowserController } from '../browser/BrowserController';
import { ToolRuntime } from '../tools/ToolRuntime';
import { InteractiveElement } from '../shared/types';

export interface SkillContext {
  toolRuntime: ToolRuntime;
  browser: BrowserController;
  /** Function to re-observe the page and get current elements */
  observe: () => Promise<InteractiveElement[]>;
  memory?: any;
}

export interface StatefulSkillContext extends SkillContext {
  goal: string;
  iterations: number;
  retryCount: number;
  lastObservation?: InteractiveElement[];
  toolOutputs: any[];
  terminationReason?: string;
  state: Record<string, any>;
}

export interface SkillResult {
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'STALLED' | 'SLOW_PROGRESS';
  success: boolean;
  data: any;
  stepsExecuted: number;
  duration: number;
  terminationReason?: string;
  failureReason?: string;
  lastMetrics?: any;
}

export interface SkillMetadata {
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

export interface Skill {
  name: string;
  description: string;
  metadata?: Partial<SkillMetadata>;
  execute(params: any, ctx: SkillContext): Promise<SkillResult>;
}
