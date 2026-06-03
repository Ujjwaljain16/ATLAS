import { Goal } from '../core/types';
import { TaskInput } from './types';
import { v4 as uuid } from 'uuid';

export class IntentPlanner {
  /**
   * Translates a high-level TaskInput into an actionable Goal for the ATLAS Runtime.
   * 
   * In Evolution 1/2, this acts as a direct mapping from parameters to sub-objectives.
   * In Evolution 3 (LLM Planner), this will invoke an LLM to generate the sub-objectives dynamically.
   */
  plan(input: TaskInput): Goal {
    const subObjectives = [];
    
    if (input.parameters) {
      for (const [key, value] of Object.entries(input.parameters)) {
        subObjectives.push({
          id: `fill_${key}_${uuid().split('-')[0]}`,
          label: `Fill ${key} field`,
          targetFieldDescription: key,
          expectedValue: String(value),
          completionCondition: { fieldLabel: key, expectedValue: String(value) }
        });
      }
    }
    
    // Fallback: If no explicit parameters exist, the entire goal is the single sub-objective
    if (subObjectives.length === 0) {
      subObjectives.push({
        id: `complete_${uuid().split('-')[0]}`,
        label: input.goal,
        targetFieldDescription: input.goal,
        expectedValue: '',
        completionCondition: { fieldLabel: input.goal, expectedValue: '' }
      });
    }

    return {
      label: input.goal,
      targetUrl: input.url,
      subObjectives
    };
  }
}
