import { InteractiveElement } from '../shared/types';

export class ProgressCalculator {
  calculateProgress(elements: InteractiveElement[], activeGoal: string): number {
    // For V2 LLM Planner, progress is harder to deterministically calculate without form topologies.
    // For now, we will return 0 or rely on the LLM to signal progress.
    return 0;
  }
}
