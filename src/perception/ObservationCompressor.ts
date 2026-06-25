import { InteractiveElement } from '../shared/types';

// No hardcoded element type priorities; rely on semantic relevance.

/**
 * ObservationCompressor reduces a large element inventory to a focused,
 * goal-relevant candidate set before passing to the LLM planner.
 *
 * Strategy:
 *   1. Remove invisible/disabled elements.
 *   2. Remove structural duplicates (same label + same type).
 *   3. Score each element: element type priority + keyword overlap with goal.
 *   4. Return top-N by score (default: 25).
 */
export class ObservationCompressor {
  constructor(private readonly topN: number = 25) {}

  compressWithStats(elements: InteractiveElement[], goalText: string): { compressed: InteractiveElement[]; before: number; after: number } {
    const before = elements.length;
    const compressed = this.compress(elements, goalText);
    return { compressed, before, after: compressed.length };
  }

  compress(elements: InteractiveElement[], goalText: string): InteractiveElement[] {
    // Step 1: filter out invisible/disabled
    const visible = elements.filter(e => e.visible && e.enabled);

    // Step 2: deduplicate by (elementType + normalised label)
    const seen = new Set<string>();
    const unique: InteractiveElement[] = [];
    for (const el of visible) {
      const key = `${el.elementType}::${(el.label || el.ariaLabel || el.text || el.placeholder || '').trim().toLowerCase().slice(0, 60)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(el);
      }
    }

    // Step 3: score each element
    const goalTerms = this.tokenise(goalText);
    const scored = unique.map(el => ({
      el,
      score: this.score(el, goalTerms)
    }));

    // Step 4: sort descending, take top-N
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, this.topN).map(s => s.el);
  }

  private score(el: InteractiveElement, goalTerms: string[]): number {
    let score = 0;

    // Tier 0: Pinned (Always survives)
    // Elements that hold active user context or state
    if (el.focused || el.expanded === true || el.checked === true || el.selected === true) {
      score += 10000;
    }

    // Tier 1: Viewport
    if (el.inViewport) {
      score += 500;
    }

    // Tier 2: Interaction
    // Elements that are heavily interactive or likely to be next steps
    if (el.editable || el.clickable) {
      score += 50;
    }

    // Tier 3: Semantic Match
    const elText = [el.label, el.ariaLabel, el.placeholder, el.text, el.role, el.name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    for (const term of goalTerms) {
      if (elText.includes(term)) score += 5;
    }

    // Tier 4: Existing hints
    if (el.confidence) score += el.confidence * 4;

    return score;
  }

  private tokenise(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  /** Report compression stats to console. */
  static report(before: number, after: number): void {
    const reduction = before === 0 ? 0 : Math.round((1 - after / before) * 100);
    console.log(`[ObservationCompressor] ${before} → ${after} elements (${reduction}% reduction)`);
  }
}
