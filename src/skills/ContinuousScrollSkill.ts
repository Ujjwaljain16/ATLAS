import { StatefulSkill } from './StatefulSkill';
import { StatefulSkillContext } from './types';
import { ScrollMetrics } from '../tools/tools/Scroll';

export class ContinuousScrollSkill extends StatefulSkill {
  name = 'ContinuousScrollSkill';
  description = 'Scrolls the page continuously until a termination condition is met (e.g. reaching the bottom or exhausting loaded content). Useful for infinite feeds or ensuring the entire page is loaded before extraction.';
  
  // We can increase max iterations for continuous scrolling
  protected maxIterations = 50;

  protected async isGoalSatisfied(ctx: StatefulSkillContext): Promise<boolean> {
    if (!ctx.state.lastScrollMetrics) return false;
    
    const metrics = ctx.state.lastScrollMetrics as ScrollMetrics;
    console.log(`[Skill Trace] ${this.name} Predicate: scrollTop=${metrics.currentTop}, delta=${metrics.delta}, isBottom=${metrics.isBottom}, progress=${metrics.progress}`);

    
    // Predicate 1: Reached physical bottom of the document
    if (metrics.isBottom) {
      ctx.terminationReason = 'Reached bottom of document.';
      return true;
    }
    
    // Predicate 2: Scroll attempted but no progress made (e.g. hit an invisible wall or infinite scroll stopped loading)
    if (metrics.delta === 0) {
      ctx.state.zeroDeltaCount = (ctx.state.zeroDeltaCount || 0) + 1;
      if (ctx.state.zeroDeltaCount >= 3) {
        ctx.terminationReason = 'No scroll progress made for 3 consecutive attempts. Assuming content exhausted.';
        return true;
      }
    } else {
      ctx.state.zeroDeltaCount = 0;
    }

    return false;
  }

  protected async onIteration(ctx: StatefulSkillContext, params: any): Promise<void> {
    console.log(`[Skill Trace] ${this.name} Executing 'scroll' tool...`);
    const scrollStart = Date.now();
    // Execute scroll action
    const scrollResult = await ctx.toolRuntime.execute({
      name: 'scroll',
      params: { direction: 'down' }
    }, ctx.browser);
    console.log(`[Skill Trace] ${this.name} 'scroll' tool finished in ${Date.now() - scrollStart}ms. Success: ${scrollResult.success}`);
    
    if (!scrollResult.success) {
      throw new Error(`Scroll failed: ${scrollResult.error?.message}`);
    }

    // Save metrics for condition checking
    ctx.state.lastScrollMetrics = scrollResult.data;
    ctx.toolOutputs.push(scrollResult.data);

    console.log(`[Skill Trace] ${this.name} Skipping heavy DOM observation during scroll loop for performance.`);
  }
}
