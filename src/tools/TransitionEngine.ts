import { InteractionState, Action } from './types';

export interface TransitionPlan {
  /**
   * Actions to execute to satisfy the required state (e.g. clicking to focus)
   */
  setupActions: Action[];
  /**
   * The modified action to execute if the target had to be redirected
   */
  resolvedAction?: Action;
}

export class TransitionEngine {
  /**
   * Generates a transition plan bridging the gap between current state and required state.
   */
  plan(action: Action, currentState: InteractionState, requiredState: Partial<InteractionState>): TransitionPlan {
    const setupActions: Action[] = [];
    let resolvedAction: Action | undefined = undefined;

    const elementId = action.params?.elementId;

    if (!elementId) return { setupActions };

    // Need editable, but currently not editable
    if (requiredState.editable && !currentState.editable) {
      // Transition: Click the target to activate/expand it
      setupActions.push({ name: 'click', params: { elementId } });
      
      // The original target was not editable (e.g., a button). The click likely opened a modal or 
      // dynamically replaced it with an input. The new input will be the browser's active element.
      resolvedAction = {
        ...action,
        params: {
          ...action.params,
          elementId: '__ACTIVE_ELEMENT__'
        }
      };
    } 
    // Need focus, but currently not focused
    else if (requiredState.focused && !currentState.focused) {
      // Transition: Click to focus
      setupActions.push({ name: 'click', params: { elementId } });
    }

    return { setupActions, resolvedAction };
  }
}
