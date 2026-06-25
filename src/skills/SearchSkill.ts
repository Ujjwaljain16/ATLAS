import { Skill, SkillContext, SkillResult } from './types';
import { InteractiveElement } from '../shared/types';

interface SearchSkillParams {
  query: string;
  url?: string; // If provided, navigate first. Otherwise assume already on search page.
}

/**
 * SearchSkill — Navigates to a search URL, finds the search input, types the query, and submits.
 * Returns the result link elements visible after submission.
 */
export class SearchSkill implements Skill {
  name = 'SearchSkill';
  description = 'Searches for a query on a given URL. Navigates to the page, finds the search box, types the query, submits, and returns result elements.';
  metadata = {
    arguments: { query: 'string (required)', url: 'string (optional)' },
    preconditions: 'None.',
    postconditions: 'Browser is navigated to a search results page.',
    sideEffects: 'Changes current URL. May overwrite world state entirely.',
    cost: 5,
    verifiable: true,
    supportsRetry: true,
    supportsRecovery: true,
    failureModes: ['NavigationTimeout', 'SearchEngineBlocked']
  };

  async execute(params: SearchSkillParams, ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    let stepsExecuted = 0;

    // Step 1: Navigate if a URL is given
    if (params.url) {
      const navResult = await ctx.toolRuntime.execute({
        name: 'navigate',
        params: { url: params.url, allowedDomains: [], strictDomainCheck: false }
      }, ctx.browser);

      stepsExecuted++;
      if (!navResult.success) {
        return { status: 'FAILED', success: false, data: null, stepsExecuted, duration: Date.now() - start, failureReason: `Navigation to ${params.url} failed: ${navResult.error?.message}` };
      }

      // Wait for page load
      await ctx.toolRuntime.execute({ name: 'wait', params: { ms: 1500 } }, ctx.browser);
      stepsExecuted++;
    }

    // Step 2: Re-observe and find search box
    const elements = await ctx.observe();
    const searchBox = this.findSearchBox(elements);

    if (!searchBox) {
      return { status: 'FAILED', success: false, data: null, stepsExecuted, duration: Date.now() - start, failureReason: 'Could not find a search input element on the page.' };
    }

    // Step 3: Click to focus, then type the query
    await ctx.toolRuntime.execute({ name: 'click_on_screen', params: { elementId: searchBox.id } }, ctx.browser);
    stepsExecuted++;

    await ctx.toolRuntime.execute({ name: 'send_keys', params: { elementId: searchBox.id, text: params.query, pressEnterAfter: false } }, ctx.browser);
    stepsExecuted++;

    // Step 4: Submit with Enter
    await ctx.toolRuntime.execute({ name: 'press_key', params: { key: 'Enter' } }, ctx.browser);
    stepsExecuted++;

    // Step 5: Wait for results
    await ctx.toolRuntime.execute({ name: 'wait', params: { ms: 2000 } }, ctx.browser);
    stepsExecuted++;

    // Step 6: Re-observe and collect result links
    const resultElements = await ctx.observe();
    const resultLinks = resultElements.filter(e => e.elementType === 'LINK' && e.visible && e.text.length > 0).slice(0, 10);

    return {
      status: 'SUCCESS',
      success: true,
      data: { resultLinks, resultCount: resultLinks.length },
      stepsExecuted,
      duration: Date.now() - start
    };
  }

  private findSearchBox(elements: InteractiveElement[]): InteractiveElement | null {
    return elements.find(e =>
      e.visible &&
      e.enabled &&
      (e.elementType === 'TEXTBOX' || e.type === 'search' || e.type === 'text') &&
      (
        (e.ariaLabel?.toLowerCase().includes('search') ?? false) ||
        (e.placeholder?.toLowerCase().includes('search') ?? false) ||
        (e.label?.toLowerCase().includes('search') ?? false) ||
        e.role === 'searchbox'
      )
    ) || null;
  }
}
