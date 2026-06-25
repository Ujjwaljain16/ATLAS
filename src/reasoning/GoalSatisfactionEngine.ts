import { PageState } from '../worldmodel/types';
import { KnowledgeManager } from '../memory/KnowledgeManager';

export interface AgentContext {
  goal: string;
  worldState: PageState;
  knowledgeSummary: string;
  history: any[];
  metrics: any;
}

export interface SatisfactionResult {
  status: 'COMPLETE' | 'FAILED' | 'PENDING';
  confidence: number;
  reason: string;
}

export class GoalSatisfactionEngine {
  constructor(private apiKey: string, private modelName: string) {}

  async evaluate(context: AgentContext): Promise<SatisfactionResult> {
    // 1. Semantic Completion
    // (If the goal is an information goal and the knowledge summary contains related keywords)
    const goalLower = context.goal.toLowerCase();
    if (goalLower.includes('read') || goalLower.includes('find') || goalLower.includes('extract') || goalLower.includes('what is')) {
      if (context.knowledgeSummary && context.knowledgeSummary !== 'No knowledge acquired yet.') {
        // Very basic semantic check: if we recently added knowledge, assume it might be complete.
        // We defer to LLM for final verification if it's ambiguous, but let's try to pass it to LLM for exactness.
      }
    }

    // 3. LLM Completion (Fallback)
    const prompt = `Goal: ${context.goal}
Current URL: ${context.worldState.url}
Page Classification: ${context.worldState.classification}

Knowledge Acquired:
${context.knowledgeSummary}

Recent Actions:
${context.history.slice(-3).map(h => h.action?.name + ' -> ' + (h.toolResult?.success ? 'SUCCESS' : 'FAIL')).join('\n')}

Based on the execution history, current page state, and acquired knowledge, determine if the goal is COMPLETE, FAILED, or PENDING.
CRITICAL: If the user's goal involves finding, reading, extracting, or reporting information, you MUST check the "Knowledge Acquired" section. If the answer is not present there, the goal is PENDING. Never guess that an information extraction task is complete just because the page loaded.
Output JSON format: { "status": "PENDING", "confidence": 0.5, "reason": "..." }`;

    try {
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey: this.apiKey });
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      const parsed = JSON.parse(response.text?.replace(/^\`\`\`json\n?/, '').replace(/\n?\`\`\`$/, '') || '{}');
      return {
        status: parsed.status || 'PENDING',
        confidence: parsed.confidence || 0.5,
        reason: parsed.reason || 'LLM evaluated.'
      };
    } catch (e: any) {
      return { status: 'PENDING', confidence: 0.1, reason: 'LLM Evaluation Error' };
    }
  }

  private extractDomain(goal: string): string | null {
    const match = goal.match(/navigate to ([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i) || goal.match(/go to ([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    return match ? match[1] : null;
  }
}
