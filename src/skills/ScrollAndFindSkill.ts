import { Skill, SkillContext, SkillResult } from './types';
import { InteractiveElement } from '../shared/types';

interface ScrollAndFindParams {
  targetDescription: string;
  maxScrolls?: number; // default 10
}

/**
 * ScrollAndFindSkill — Scrolls down incrementally, re-observing on each step,
 * until an element matching the target description is found or max scrolls is reached.
 */
export class ScrollAndFindSkill implements Skill {
  name = 'ScrollAndFindSkill';
  description = 'Scrolls down the page incrementally and re-observes after each scroll until a target element (described in natural language) is found or the page is exhausted.';

  async execute(params: ScrollAndFindParams, ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const maxScrolls = params.maxScrolls ?? 10;
    let stepsExecuted = 0;

    for (let i = 0; i < maxScrolls; i++) {
      // Observe current visible elements
      const elements = await ctx.observe();
      stepsExecuted++;

      const match = this.findMatch(elements, params?.targetDescription);
      if (match) {
        return {
          status: 'SUCCESS',
          success: true,
          data: { element: match, foundOnScroll: i },
          stepsExecuted,
          duration: Date.now() - start
        };
      }

      // Scroll down
      const scrollResult = await ctx.toolRuntime.execute({
        name: 'scroll',
        params: { direction: 'down', amount: 400 }
      }, ctx.browser);
      stepsExecuted++;

      if (!scrollResult.success) {
        return { status: 'FAILED', success: false, data: null, stepsExecuted, duration: Date.now() - start, failureReason: `Scroll failed: ${scrollResult.error?.message}` };
      }

      // Short wait for DOM to update after scroll
      await ctx.toolRuntime.execute({ name: 'wait', params: { ms: 500 } }, ctx.browser);
      stepsExecuted++;
    }

    return {
      status: 'FAILED',
      success: false,
      data: null,
      stepsExecuted,
      duration: Date.now() - start,
      failureReason: `Element matching "${params.targetDescription}" not found after ${maxScrolls} scrolls.`
    };
  }

  private findMatch(elements: InteractiveElement[], description: string | undefined): InteractiveElement | null {
    if (!description) return null;
    const terms = description.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    return elements.find(e => {
      if (!e.visible) return false;
      const searchTarget = [e.text, e.label, e.ariaLabel, e.placeholder, e.role]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.some(term => searchTarget.includes(term));
    }) ?? null;
  }
}
