import { GoogleGenAI } from '@google/genai';

export type TaskIntent =
  | 'MULTIMEDIA'
  | 'SEARCH'
  | 'FORM_FILL'
  | 'NAVIGATION'
  | 'DATA_EXTRACTION'
  | 'AUTHENTICATION'
  | 'GENERIC';

export type StepType =
  | 'NAVIGATE'
  | 'SEARCH'
  | 'CLICK'
  | 'TYPE'
  | 'WAIT'
  | 'SCROLL'
  | 'EXTRACT'
  | 'VERIFY';

export interface TaskStep {
  id: number;
  description: string;
  type: StepType;
  /** Optional success condition. Used by GoalVerifier to check step completion. */
  successCondition?: string;
}

export interface TaskPlan {
  originalGoal: string;
  intent: TaskIntent;
  /** Best-guess starting URL (may be empty if unknown) */
  navigationTarget: string;
  steps: TaskStep[];
  /** High-level one-line summary of the plan */
  summary: string;
}

export class TaskAnalyzer {
  private ai: GoogleGenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = 'gemini-2.5-flash') {
    this.ai = new GoogleGenAI({ apiKey });
    this.modelName = modelName;
  }

  async analyze(goal: string): Promise<TaskPlan> {
    const prompt = `
You are ATLAS Task Analyzer. Your job is to decompose a user goal into a structured, step-by-step execution plan for a browser agent.

User Goal: "${goal}"

Rules:
1. Identify the primary intent of the task.
2. Determine the starting URL if it can be inferred (e.g., "YouTube" → "https://www.youtube.com").
3. Break the goal into a minimal, ordered list of atomic steps. Each step must be ONE concrete action.
4. Assign a StepType to each step: NAVIGATE | SEARCH | CLICK | TYPE | WAIT | SCROLL | EXTRACT | VERIFY.
5. For each step, optionally provide a measurable success condition.
6. Keep the plan lean. Do not over-decompose. A good plan has 3-10 steps.

Respond ONLY in this JSON format:
{
  "intent": "MULTIMEDIA" | "SEARCH" | "FORM_FILL" | "NAVIGATION" | "DATA_EXTRACTION" | "AUTHENTICATION" | "GENERIC",
  "navigationTarget": "https://... or empty string if unknown",
  "summary": "One sentence summary of the overall plan",
  "steps": [
    {
      "id": 1,
      "description": "Human-readable step description",
      "type": "NAVIGATE",
      "successCondition": "Page URL contains youtube.com"
    }
  ]
}
`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      if (!response.text) throw new Error('Empty response from TaskAnalyzer');

      let rawText = response.text.trim();
      if (rawText.startsWith('```json')) rawText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      else if (rawText.startsWith('```')) rawText = rawText.replace(/^```\n?/, '').replace(/\n?```$/, '');

      const parsed = JSON.parse(rawText.trim());

      return {
        originalGoal: goal,
        intent: parsed.intent || 'GENERIC',
        navigationTarget: parsed.navigationTarget || '',
        summary: parsed.summary || goal,
        steps: (parsed.steps || []).map((s: any, i: number) => ({
          id: s.id ?? i + 1,
          description: s.description,
          type: s.type || 'CLICK',
          successCondition: s.successCondition
        }))
      };
    } catch (err: any) {
      console.warn('[TaskAnalyzer] LLM decomposition failed, falling back to single-step plan:', err.message);
      return this.buildFallback(goal);
    }
  }

  private buildFallback(goal: string): TaskPlan {
    return {
      originalGoal: goal,
      intent: 'GENERIC',
      navigationTarget: '',
      summary: goal,
      steps: [{ id: 1, description: goal, type: 'NAVIGATE', successCondition: 'Goal is achieved' }]
    };
  }
}
