export interface CompletionResult {
  status: 'COMPLETE' | 'FAILED' | 'PENDING';
  confidence: number;
  evidence: string[];
  nextSuggestedGoal?: string;
}

export interface CompletionContext {
  goal: string;
  url: string;
  pageContext: any;
  worldState: any;
  executionHistory: any[];
  stateDelta: any;
}

export interface CompletionRule {
  name: string;
  supports(context: CompletionContext): boolean;
  evaluate(context: CompletionContext): Promise<CompletionResult>;
}
