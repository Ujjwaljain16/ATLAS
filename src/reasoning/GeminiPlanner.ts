import { PlannerProvider } from './PlannerProvider';
import { PageState } from '../worldmodel/types';
import { RankedCandidate, Decision } from './types';
import { GoogleGenAI } from '@google/genai';

export class GeminiPlanner implements PlannerProvider {
  private ai: GoogleGenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = 'gemini-2.5-flash') {
    this.ai = new GoogleGenAI({ apiKey });
    this.modelName = modelName;
  }

  async planNextAction(
    goal: string, 
    pageState: PageState, 
    candidates: RankedCandidate[], 
    previousActions: any[], 
    lastReflectionLearning?: string | null,
    pageContext?: any,
    completedObjectives: string[] = [],
    stateDelta: any = {},
    availableCapabilities: any[] = [],
    knowledgeSummary: string = '',
    executionContextSummary: any = null
  ): Promise<Decision> {
    const structuredContext = {
      goal,
      page: {
        url: pageState.url,
        title: pageState.title,
        type: pageContext?.pageType || pageState.classification,
        contextConfidence: pageContext?.confidence || 0,
        ready: pageState.ready
      },
      completed_objectives: completedObjectives || [],
      state_delta: stateDelta || {},
      key_elements: candidates.slice(0, 20).map(c => ({
        id: c.element.id,
        type: c.element.elementType,
        label: c.element.label || c.element.ariaLabel || c.element.placeholder || c.element.text || c.element.elementType || '',
        role: c.element.role,
        value: c.element.value,
        visible: c.element.visible,
        confidence: c.confidence
      })),
      execution_history: previousActions.slice(-5).map(a => 
        `Action: ${a.action?.name}, Target: ${a.targetSelector || 'none'}\n  Observed: ${a.actionVerification?.observed || 'unknown'}\n  Verification: ${a.actionVerification?.success ? 'PASS' : 'FAIL'} (${a.actionVerification?.verificationType || 'unknown'})`
      ),
      knowledge_summary: knowledgeSummary,
      reflection_from_last_step: lastReflectionLearning || null,
      goal_status: {
        overall: "IN_PROGRESS",
        steps_done: previousActions.length,
        next_step_hint: "Determine the next action based on candidates"
      },
      candidate_rankings: candidates.slice(0, 5).map(c => ({
        id: c.element.id,
        label: c.element.label || c.element.text || c.element.id,
        score: c.confidence,
        action_hint: c.element.elementType === 'TEXTBOX' ? 'fill' : 'click'
      })),
      available_capabilities: availableCapabilities || [],
      environment: pageState.environment,
      execution_context: executionContextSummary
    };

    const prompt = `
You are ATLAS, an expert Universal Browser Agent.
Analyze the following Structured Agent Context and determine the single next best action.

Wait Tools:
- wait_until: Wait for a condition to be met ('element_visible', 'network_quiet', 'url_changed', 'dom_stable'). Use this to wait for page loads or animations to complete. Never use fixed sleeps.

Capabilities:
- Capability Detection: If the goal requires continuous navigation (e.g. scrolling continuously to the bottom, infinite feeds, or reaching the end of a long document), you MUST emit a capability action instead of a standard tool. 
  Example: {"name": "capability", "params": {"type": "continuous_scroll"}}

CRITICAL INSTRUCTIONS:
1. Capability Constraints: You MUST ONLY select tools and skills listed in 'available_capabilities'. DO NOT hallucinate capabilities. Pay attention to 'preconditions' and 'sideEffects'.
2. Confidence Calibration: Never output exactly 1.00 unless it is a mathematical certainty. Output realistic confidence scores based on element match quality (e.g., 0.96 for a near-perfect match, 0.82 for a fuzzy semantic match, 0.45 if guessing).
3. Action Verification: You CANNOT declare the goal COMPLETE. If you believe the goal is complete, simply output a wait_until() action or any final action. The Goal Validator will verify completion independently.
6. WAIT STRATEGY: If an action triggers a navigation or async load, DO NOT just assume it finishes instantly. Use 'wait_until' with 'network_quiet' or 'url_changed' to explicitly verify stability before proceeding.

Structured Agent Context:
${JSON.stringify(structuredContext, null, 2)}

Respond strictly in JSON format:
{
  "thought": "Brief reasoning about what to do next based on candidates and history",
  "action": {
    "name": "<tool_name>",
    "params": { ...tool parameters... }
  },
  "expected_outcome": "What observably should change on the screen if this succeeds?",
  "goal_status_guess": "IN_PROGRESS" | "COMPLETE" | "FAILED",
  "confidence": <number between 0 and 1>
}
    `;

    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const response = await this.ai.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          }
        });

        if (!response.text) {
          throw new Error("Gemini returned empty response");
        }

        let rawText = response.text.trim();
        // Remove markdown formatting if present
        if (rawText.startsWith('```json')) {
          rawText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (rawText.startsWith('```')) {
          rawText = rawText.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        const parsed = JSON.parse(rawText.trim());
        return {
          thought: parsed.thought,
          action: parsed.action,
          expectedOutcome: parsed.expected_outcome || parsed.expectedOutcome || "No expected outcome provided",
          goalStatusGuess: parsed.goal_status_guess || parsed.goalStatusGuess || 'IN_PROGRESS',
          confidence: parsed.confidence,
          discoveryTier: 0,
          matchedSignal: 'gemini-llm',
          targetSelector: candidates.find(c => c.element.id === parsed.action?.params?.elementId)?.element.selector,
        };
      } catch (error: any) {
        attempts++;
        console.error(`Gemini Planner failed on attempt ${attempts}:`, error.message || error);
        if (attempts >= maxAttempts) {
          throw error;
        }
        // Exponential backoff: 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
    throw new Error("Gemini Planner failed after max attempts");
  }
}
