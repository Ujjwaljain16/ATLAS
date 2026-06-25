import { PageState } from '../worldmodel/types';
import { ToolResult, Action } from '../tools/types';

export interface DeltaContext {
  previousState: PageState | null;
  currentState: PageState;
  lastAction: Action | null;
  lastToolResult: ToolResult<any> | null;
  newKnowledgeAcquired: boolean;
}

export class DeltaAnalyzer {
  /**
   * Analyzes if a meaningful change occurred in the world state or knowledge since the last step.
   * If false, it's highly likely the agent is stuck in a loop and should skip the expensive LLM planning.
   */
  hasMeaningfulChange(context: DeltaContext): boolean {
    if (!context.previousState) return true; // First step is always meaningful
    if (context.newKnowledgeAcquired) return true; // We learned something new
    if (context.currentState.url !== context.previousState.url) return true; // Navigated

    // Check if DOM hash or element count shifted significantly
    const prevCount = context.previousState.elements.length;
    const currCount = context.currentState.elements.length;
    if (Math.abs(currCount - prevCount) > 2) return true;

    // Check if the last action was a "wait" or "scroll", which might just be taking time
    // Also allow stateful UI interactions (click, type, keys) to proceed, as they may change focus, values, 
    // or hidden state without changing the total DOM node count by > 2.
    const name = context.lastAction?.name;
    if (name === 'wait' || name === 'wait_until' || name?.startsWith('scroll') ||
        name === 'click' || name === 'click_on_screen' || name === 'type' || 
        name === 'send_keys' || name === 'press_key') {
      return true;
    }

    // If URL is the same, elements are almost exactly the same, no new knowledge, and we aren't waiting...
    // It's likely a loop (e.g., repeatedly extracting the same text).
    return false;
  }
}
