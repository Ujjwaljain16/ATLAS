import { GoogleGenAI } from '@google/genai';
import { PageState } from '../worldmodel/types';

export class GoalVerifier {
  private ai: GoogleGenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = 'gemini-2.5-flash') {
    this.ai = new GoogleGenAI({ apiKey });
    this.modelName = modelName;
  }

  async verify(goal: string, pageState: PageState): Promise<{ status: 'COMPLETE' | 'IN_PROGRESS' | 'FAILED', reason: string }> {
    const context = {
      goal,
      page: {
        url: pageState.url,
        title: pageState.title,
        type: pageState.classification,
        ready: pageState.ready
      },
      active_dialog: pageState.environment?.activeDialog,
      open_tabs: pageState.environment?.openTabsCount,
      visible_text_summary: pageState.pageMetadata.visibleTextBlocks.slice(0, 10).join(' ') // just a sample
    };

    const prompt = `
You are ATLAS Goal Verifier. Your job is to strictly evaluate whether a given goal has been ACHIEVED based on the current World State.

Goal: "${goal}"

Current World State (Partial):
${JSON.stringify(context, null, 2)}

Is the goal completely achieved? 
- Reply "COMPLETE" if the goal is fully achieved.
- Reply "IN_PROGRESS" if the goal is partially achieved or the agent is on the right track but needs more actions.
- Reply "FAILED" if an unrecoverable error prevents the goal from being achieved.

Respond ONLY in valid JSON format:
{
  "status": "COMPLETE" | "IN_PROGRESS" | "FAILED",
  "reason": "Explain why based strictly on the visible World State."
}
`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      if (!response.text) return { status: 'IN_PROGRESS', reason: 'No response from AI' };
      
      let rawText = response.text.trim();
      if (rawText.startsWith('\`\`\`json')) {
        rawText = rawText.replace(/^\`\`\`json\n?/, '').replace(/\n?\`\`\`$/, '');
      } else if (rawText.startsWith('\`\`\`')) {
        rawText = rawText.replace(/^\`\`\`\n?/, '').replace(/\n?\`\`\`$/, '');
      }

      const parsed = JSON.parse(rawText.trim());
      return {
        status: parsed.status as 'COMPLETE' | 'IN_PROGRESS' | 'FAILED',
        reason: parsed.reason
      };
    } catch (error: any) {
      console.error('Goal Verifier failed:', error.message);
      return { status: 'IN_PROGRESS', reason: 'Failed to verify, assuming in progress' };
    }
  }
}
