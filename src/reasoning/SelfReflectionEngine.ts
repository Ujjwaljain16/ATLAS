import { GoogleGenAI } from '@google/genai';
import { PageState } from '../worldmodel/types';
import { Action, ToolResult } from '../tools/types';

export type OutcomeMatch = 'EXPECTED' | 'UNEXPECTED_SUCCESS' | 'UNEXPECTED_FAILURE' | 'PARTIAL';
export type StrategyVerdict = 'CONTINUE' | 'RETRY_DIFFERENT' | 'ESCALATE' | 'ABANDON_STEP';

export interface ReflectionInput {
  planned_action: Action;
  expected_outcome: string;
  actual_tool_result: Pick<ToolResult<any>, 'success' | 'error'>;
  pre_action_world: { url: string; title: string; classification: string };
  post_action_world: { url: string; title: string; classification: string };
}

export interface ReflectionOutput {
  outcome_match: OutcomeMatch;
  explanation: string;
  strategy_verdict: StrategyVerdict;
  learning: string; // injected into next planning cycle's context
}

export class SelfReflectionEngine {
  private ai: GoogleGenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = 'gemini-2.5-flash') {
    this.ai = new GoogleGenAI({ apiKey });
    this.modelName = modelName;
  }

  async reflect(input: ReflectionInput): Promise<ReflectionOutput> {
    // Fast rule-based path — avoid an LLM call for obvious successes
    if (input.actual_tool_result.success) {
      const urlChanged = input.pre_action_world.url !== input.post_action_world.url;
      const titleChanged = input.pre_action_world.title !== input.post_action_world.title;
      return {
        outcome_match: 'EXPECTED',
        explanation: `Action succeeded. ${urlChanged ? 'Page navigated.' : ''} ${titleChanged ? 'Page title changed.' : ''}`.trim(),
        strategy_verdict: 'CONTINUE',
        learning: '' // no special learning needed on clear success
      };
    }

    // For failures: delegate to LLM for rich contextual learning
    const prompt = `
You are ATLAS Self-Reflection Engine. Evaluate the outcome of the last agent action and produce actionable learnings.

Planned Action: ${JSON.stringify(input.planned_action)}
Expected Outcome: "${input.expected_outcome}"
Actual Result: ${JSON.stringify({ success: input.actual_tool_result.success, error: input.actual_tool_result.error })}
Pre-Action Page: ${JSON.stringify(input.pre_action_world)}
Post-Action Page: ${JSON.stringify(input.post_action_world)}

Instructions:
- Compare expected vs actual.
- Diagnose the root cause (element not found, page not ready, wrong target, timing issue, etc.)
- Produce a ONE SENTENCE learning that the next planning step can use to improve.
- Keep the learning extremely concrete and actionable (e.g., "Element was not clickable. Try scrolling it into view first, or use press_key(Tab) to focus instead of click.").
- Do NOT repeat generic advice. Be specific to the failure context above.

Respond ONLY in valid JSON:
{
  "outcome_match": "EXPECTED" | "UNEXPECTED_SUCCESS" | "UNEXPECTED_FAILURE" | "PARTIAL",
  "explanation": "Why the outcome was or wasn't what was expected.",
  "strategy_verdict": "CONTINUE" | "RETRY_DIFFERENT" | "ESCALATE" | "ABANDON_STEP",
  "learning": "Concrete, specific, one-sentence actionable takeaway for the next planning step."
}
`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      if (!response.text) {
        return this.buildFallback(input);
      }

      let rawText = response.text.trim();
      if (rawText.startsWith('```json')) rawText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      else if (rawText.startsWith('```')) rawText = rawText.replace(/^```\n?/, '').replace(/\n?```$/, '');

      const parsed = JSON.parse(rawText.trim());
      return {
        outcome_match: parsed.outcome_match,
        explanation: parsed.explanation,
        strategy_verdict: parsed.strategy_verdict,
        learning: parsed.learning
      };
    } catch (err: any) {
      console.error('[SelfReflectionEngine] LLM call failed:', err.message);
      return this.buildFallback(input);
    }
  }

  private buildFallback(input: ReflectionInput): ReflectionOutput {
    const errorMsg = input.actual_tool_result.error?.message || 'Unknown error';
    return {
      outcome_match: 'UNEXPECTED_FAILURE',
      explanation: `Action failed: ${errorMsg}`,
      strategy_verdict: 'RETRY_DIFFERENT',
      learning: `Previous attempt failed with: "${errorMsg}". Consider an alternative approach.`
    };
  }
}
