import { Skill, SkillContext, SkillResult, StatefulSkillContext } from './types';

export abstract class StatefulSkill implements Skill {
  abstract name: string;
  abstract description: string;
  
  protected maxIterations = 100;
  protected maxDurationMs = 120000; // 2 minutes for long pages like Wikipedia
  protected maxNoProgress = 5;

  async execute(params: any, ctx: SkillContext): Promise<SkillResult> {
    const startTime = Date.now();
    const statefulCtx: StatefulSkillContext = {
      ...ctx,
      goal: params.goal || '',
      iterations: 0,
      retryCount: 0,
      toolOutputs: [],
      state: {}
    };

    console.log(`\n[Skill Trace] Starting ${this.name}`);

    while (statefulCtx.iterations < this.maxIterations) {
      console.log(`\n--- [${this.name}] Iteration ${statefulCtx.iterations + 1} ---`);
      const iterStartTime = Date.now();
      
      console.log(`[Action Start] Executing iteration logic...`);
      await this.onIteration(statefulCtx, params);
      console.log(`[Action End] Iteration logic completed in ${Date.now() - iterStartTime}ms`);

      console.log(`[Predicate Start] Evaluating termination predicate...`);
      const isSatisfied = await this.isGoalSatisfied(statefulCtx);
      console.log(`[Predicate End] Satisfied: ${isSatisfied}`);
      
      if (isSatisfied) {
        const isStalled = statefulCtx.terminationReason?.toLowerCase().includes('progress');
        const status = isStalled ? 'STALLED' : 'SUCCESS';
        console.log(`[Skill Trace] ${this.name} completed with status: ${status}. Reason: ${statefulCtx.terminationReason}`);
        return {
          status,
          success: !isStalled,
          data: statefulCtx.state,
          stepsExecuted: statefulCtx.iterations + 1,
          duration: Date.now() - startTime,
          terminationReason: statefulCtx.terminationReason,
          lastMetrics: statefulCtx.state.lastScrollMetrics || statefulCtx.state.lastMetrics
        };
      }

      const elapsed = Date.now() - startTime;
      if (elapsed > this.maxDurationMs) {
        const isProgressing = !statefulCtx.state.zeroDeltaCount || statefulCtx.state.zeroDeltaCount < 2;
        const status = isProgressing ? 'SLOW_PROGRESS' : 'TIMEOUT';
        
        console.warn(`[Skill Trace] ${this.name} aborted: ${status}. (${elapsed}ms)`);
        return {
          status,
          success: false,
          data: statefulCtx.state,
          stepsExecuted: statefulCtx.iterations + 1,
          duration: elapsed,
          failureReason: `Max duration (${this.maxDurationMs}ms) exceeded. ${isProgressing ? 'Still making progress but budget exhausted.' : ''}`.trim(),
          lastMetrics: statefulCtx.state.lastScrollMetrics || statefulCtx.state.lastMetrics
        };
      }

      if (statefulCtx.state.zeroDeltaCount && statefulCtx.state.zeroDeltaCount >= this.maxNoProgress) {
         console.warn(`[Skill Trace] ${this.name} aborted: STALLED. No progress for ${this.maxNoProgress} iterations.`);
         return {
           status: 'STALLED',
           success: false,
           data: statefulCtx.state,
           stepsExecuted: statefulCtx.iterations + 1,
           duration: elapsed,
           failureReason: `No progress for ${this.maxNoProgress} iterations.`,
           lastMetrics: statefulCtx.state.lastScrollMetrics || statefulCtx.state.lastMetrics
         };
      }

      statefulCtx.iterations++;
    }

    console.warn(`[Skill Trace] ${this.name} aborted: Max iterations reached.`);
    return {
      status: 'FAILED',
      success: false,
      data: statefulCtx.state,
      stepsExecuted: statefulCtx.iterations,
      duration: Date.now() - startTime,
      failureReason: statefulCtx.terminationReason || `Max iterations (${this.maxIterations}) reached without satisfying goal.`,
      lastMetrics: statefulCtx.state.lastScrollMetrics || statefulCtx.state.lastMetrics
    };
  }

  /**
   * Determine if the skill has finished its work.
   */
  protected abstract isGoalSatisfied(ctx: StatefulSkillContext): Promise<boolean>;

  /**
   * The core iteration logic. Called every loop.
   */
  protected abstract onIteration(ctx: StatefulSkillContext, params: any): Promise<void>;
}
