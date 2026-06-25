import { PageState } from '../worldmodel/types';
import { ElementDiscovery } from './ElementDiscovery';
import { PlannerProvider } from './PlannerProvider';
import { GoalVerifier } from './GoalVerifier';
import { ObservationCompressor } from '../perception/ObservationCompressor';

export class ReasoningEngine {
  private verifier: GoalVerifier;
  private compressor: ObservationCompressor;

  constructor(
    private elementDiscovery: ElementDiscovery,
    private planner: PlannerProvider,
    apiKey: string,
    modelName: string = 'gemini-2.5-flash'
  ) {
    this.verifier = new GoalVerifier(apiKey, modelName);
    this.compressor = new ObservationCompressor(25);
  }

  async decide(
    pageState: PageState, 
    memory: any, 
    goal: string, 
    pageContext?: any, 
    completedObjectives?: string[], 
    stateDelta?: any,
    availableCapabilities?: any[],
    executionContextSummary?: any
  ) {
    // 1. Observation Compression — reduce to top 25 goal-relevant elements
    const compressedElements = this.compressor.compress(pageState.elements, goal);
    ObservationCompressor.report(pageState.elements.length, compressedElements.length);

    // 2. Element Discovery (rank compressed candidates against the goal)
    const candidates = this.elementDiscovery.discover(compressedElements, goal);

    // 3. Retrieve self-reflection learning from last step (if any)
    const lastLearning: string | null = memory.stm?.getLastLearning?.() ?? null;

    // 4. LLM Task Planner — pass lastLearning for context-aware decisions
    const previousActions = memory.execution ? memory.execution.getEntries() : [];
    
    const decision = await this.planner.planNextAction(
      goal,
      pageState,
      candidates,
      previousActions,
      lastLearning,
      pageContext,
      completedObjectives,
      stateDelta,
      availableCapabilities,
      memory.stm?.knowledge?.getSummary() || 'No knowledge acquired yet.',
      executionContextSummary
    );

    // 5. Build candidateList for Decision Trace (top 5)
    const candidateList = candidates.slice(0, 5).map(c => {
      // UUID-free label hierarchy: name > label > ariaLabel > placeholder > text > role > type > [UUID]
      const el = c.element;
      const humanLabel = el.name || el.label || el.ariaLabel || el.placeholder ||
        (el.text?.length ? el.text.substring(0, 20) : null) ||
        el.role ||
        el.elementType ||
        '[UUID]';
      return {
        id: el.id,
        label: humanLabel,
        score: Math.round(c.confidence * 100) / 100,
        type: el.elementType,
        matchedSignal: c.matchedSignal || 'semantic_score',
      };
    });

    return {
      ...decision,
      candidateList,
      formCandidates: [] // Legacy field
    };
  }

  async evaluateCompletion(before: PageState, after: PageState, goalText: string, action: any): Promise<'COMPLETE' | 'FAILED' | 'PENDING'> {
    if (action?.name === 'complete') return 'COMPLETE';
    const verification = await this.verifier.verify(goalText, after);
    if (verification.status === 'COMPLETE') return 'COMPLETE';
    if (verification.status === 'FAILED') return 'FAILED';
    return 'PENDING';
  }
}
