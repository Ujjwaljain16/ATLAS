import { InteractiveElement } from '../shared/types';
import { A11yRecord } from './types';

// Playwright's native A11y node structure (approximate)
export interface A11ySnapshotNode {
  role: string;
  name?: string;
  value?: string | number;
  description?: string;
  keyshortcuts?: string;
  roledescription?: string;
  valuetext?: string;
  disabled?: boolean;
  expanded?: boolean;
  focused?: boolean;
  modal?: boolean;
  multiline?: boolean;
  multiselectable?: boolean;
  readonly?: boolean;
  required?: boolean;
  selected?: boolean;
  checked?: boolean | 'mixed';
  pressed?: boolean | 'mixed';
  level?: number;
  valuemin?: number;
  valuemax?: number;
  autocomplete?: string;
  haspopup?: string;
  invalid?: string;
  orientation?: string;
  children?: A11ySnapshotNode[];
}

export class AccessibilityMatcher {
  /**
   * Enriches DOM elements with Accessibility Tree signals.
   * Playwright's A11y tree doesn't guarantee 1:1 mapping with DOM nodes without
   * expensive evaluation, so we use heuristic matching based on role and computed name.
   */
  static enrich(domElements: InteractiveElement[], a11ySnapshot: A11ySnapshotNode | null): InteractiveElement[] {
    if (!a11ySnapshot) return domElements;
    
    // Flatten A11y tree for easier matching
    const flatA11yNodes: A11ySnapshotNode[] = [];
    const flatten = (node: A11ySnapshotNode) => {
      flatA11yNodes.push(node);
      if (node.children) {
        node.children.forEach(flatten);
      }
    };
    flatten(a11ySnapshot);
    
    // Create an enriched copy of domElements
    return domElements.map(el => {
      // Find a matching A11y node.
      // A strong match: role matches AND (computed label matches or it has a valid name)
      // Since geometry isn't in Playwright's default A11y snapshot, we rely on semantic correlation.
      
      const matchedNode = flatA11yNodes.find(node => {
        const roleMatches = this.rolesMatch(el.role || el.elementType, node.role);
        
        // Exact name match or substring match
        const nameMatches = node.name && (
          el.ariaLabel === node.name ||
          el.label === node.name ||
          (el.text && el.text.includes(node.name))
        );
        
        return roleMatches && nameMatches;
      });

      if (matchedNode && matchedNode.name) {
        return {
          ...el,
          ariaLabel: matchedNode.name, // Override with browser's computed name
          enabled: matchedNode.disabled !== undefined ? !matchedNode.disabled : el.enabled,
          expanded: matchedNode.expanded !== undefined ? matchedNode.expanded : el.expanded,
          selected: matchedNode.selected !== undefined ? matchedNode.selected : el.selected,
          checked: matchedNode.checked === true ? true : (matchedNode.checked === false ? false : el.checked),
          confidence: (el.confidence || 0.5) + 0.10 // V2 Requirement: +0.10 bonus
        };
      }
      
      // If element is in DOM but NOT matched in A11y (likely decorative or hidden from SR)
      return {
        ...el,
        confidence: (el.confidence || 0.5) - 0.05
      };
    });
  }
  
  private static rolesMatch(domRoleOrType: string, a11yRole: string): boolean {
    const d = domRoleOrType.toLowerCase();
    const a = a11yRole.toLowerCase();
    
    if (d === a) return true;
    
    // Mapping DOM tags/types to ARIA roles
    if (d === 'button' && a === 'button') return true;
    if (d === 'link' && a === 'link') return true;
    if (d === 'checkbox' && a === 'checkbox') return true;
    if (d === 'radio' && a === 'radio') return true;
    if ((d === 'textbox' || d === 'textarea' || d === 'input') && (a === 'textbox' || a === 'searchbox')) return true;
    if ((d === 'dropdown' || d === 'select') && (a === 'combobox' || a === 'listbox')) return true;
    
    return false;
  }
}
