import { PageState } from '../worldmodel/types';
import { RankedCandidate, Decision } from './types';

export interface PlannerProvider {
  /**
   * Determine the next action based on the current goal and world model.
   * @param lastReflectionLearning - Optional learning string from the previous step's self-reflection.
   */
  planNextAction(
    goal: string,
    pageState: PageState,
    candidates: RankedCandidate[],
    previousActions: any[],
    lastReflectionLearning?: string | null,
    pageContext?: any,
    completedObjectives?: string[],
    stateDelta?: any,
    availableCapabilities?: any[],
    knowledgeSummary?: string,
    executionContextSummary?: any
  ): Promise<Decision>;
}
