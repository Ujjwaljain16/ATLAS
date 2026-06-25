import { PageState } from '../worldmodel/types';
import { InteractiveElement } from '../shared/types';

export class SemanticIdentityResolver {
  /**
   * Finds the semantic twin of a target element in the new DOM state.
   * Completely ignores UUIDs, focusing on role, name, aria-label, and placeholder.
   */
  static resolve(targetId: string, beforeState: PageState, afterState: PageState): InteractiveElement | undefined {
    const beforeElement = beforeState.elements.find(e => e.id === targetId);
    if (!beforeElement) return undefined;

    // Direct UUID match (sometimes elements survive)
    const exactMatch = afterState.elements.find(e => e.id === targetId);
    if (exactMatch) return exactMatch;

    // Semantic Identity Match
    return afterState.elements.find(e => {
      // Must have the same role/tag
      if (e.role !== beforeElement.role && e.tag !== beforeElement.tag) return false;

      // Check for identity markers
      const sameName = e.name && e.name === beforeElement.name;
      const sameAriaLabel = e.ariaLabel && e.ariaLabel === beforeElement.ariaLabel;
      const samePlaceholder = e.placeholder && e.placeholder === beforeElement.placeholder;
      const sameText = e.text && e.text === beforeElement.text;

      return sameName || sameAriaLabel || samePlaceholder || sameText;
    });
  }
}
