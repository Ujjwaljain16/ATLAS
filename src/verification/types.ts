import { PageState } from '../worldmodel/types';
import { Action, ToolResult } from '../tools/types';

export interface VerificationResult {
  success: boolean;
  reason: string;
  verificationType: 'DOM' | 'LLM' | 'HYBRID' | 'URL';
  expected?: string;
  observed?: string;
}

export interface VerificationContext {
  beforeState: PageState;
  afterState: PageState;
  action: Action;
  expectedOutcome?: string;
  toolResult?: ToolResult<any>;
}

export interface ActionVerifier {
  name: string;
  verify(context: VerificationContext): Promise<VerificationResult>;
}
